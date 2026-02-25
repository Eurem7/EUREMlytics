"""
EnterpriseDataEngine
====================
Production-grade data cleaning pipeline.

Pipeline order (intentional):
  1. Column header normalisation
  2. String normalisation  (object cols only)
  3. Unit stripping        (removes "sq.m.", "kg", "%" etc.)
  4. Category harmonisation (abbreviation/variant mapping)
  5. Duplicate removal
  6. Per-column type inference → imputation → outlier handling
  7. Constant & near-constant column flagging
  8. EDA report generation

Design principles:
  - Every mutation is logged with before/after counts where meaningful
  - No silent data loss — dropped columns are recorded with reason
  - Quality score appended AFTER drop decision (no phantom scores)
  - All config-driven — zero hardcoded thresholds
  - Thread-safe: no global state, all state lives on the instance
"""

from __future__ import annotations

import re
import unicodedata
import logging
from datetime import datetime
from typing import Any

import numpy as np
import pandas as pd
from scipy import stats as scipy_stats

from .config import CleaningConfig
from .utils import (
    PLACEHOLDER_VALUES,
    UNIT_PATTERNS,
    ABBREVIATION_MAPS,
    sanitize_numeric,
    strip_control_chars,
    detect_outliers_iqr,
    detect_outliers_zscore,
)

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def _safe_mode(series: pd.Series) -> Any:
    """Return mode[0] or NaN if series is empty / all-null."""
    m = series.dropna().mode()
    return m.iloc[0] if not m.empty else np.nan


def _pct(n: int, total: int) -> str:
    return f"{n / total * 100:.1f}%" if total else "0%"


# ─────────────────────────────────────────────
# Engine
# ─────────────────────────────────────────────

class EnterpriseDataEngine:
    """
    Full-pipeline data cleaning and EDA engine.

    Parameters
    ----------
    df     : Raw input DataFrame
    config : CleaningConfig instance (all thresholds live here)
    """

    def __init__(self, df: pd.DataFrame, config: CleaningConfig = None):
        if config is None:
            config = CleaningConfig()

        if not isinstance(df, pd.DataFrame):
            raise TypeError("df must be a pandas DataFrame")
        if df.empty:
            raise ValueError("Input DataFrame is empty")

        self.original_df: pd.DataFrame = df.copy(deep=True)
        self.df: pd.DataFrame = df.copy(deep=True)
        self.config: CleaningConfig = config
        self.audit_log: list[dict] = []
        self.column_quality: list[dict] = []
        self._total_rows: int = len(df)
        self._started_at: datetime = datetime.utcnow()

    # ──────────────────────────────────────────
    # Internal logging
    # ──────────────────────────────────────────

    def _log(self, **kwargs) -> None:
        entry = {"timestamp": datetime.utcnow().isoformat(), **kwargs}
        self.audit_log.append(entry)
        logger.debug(entry)

    # ──────────────────────────────────────────
    # Step 1 — Column header normalisation
    # ──────────────────────────────────────────

    def normalise_column_headers(self) -> None:
        """
        Lowercase, strip, collapse whitespace, replace spaces/hyphens
        with underscores, strip leading digits, remove special chars.
        E.g. "  Sale Price (£) " -> "sale_price"
        """
        rename_map = {}
        for col in self.df.columns:
            clean = str(col)
            clean = unicodedata.normalize("NFKD", clean)
            clean = clean.lower().strip()
            clean = re.sub(r"[\s\-]+", "_", clean)
            clean = re.sub(r"[^\w]", "", clean)         # remove non-word chars
            clean = re.sub(r"_+", "_", clean).strip("_")
            clean = re.sub(r"^(\d)", r"col_\1", clean)  # cannot start with digit
            if not clean:
                clean = f"col_{list(self.df.columns).index(col)}"
            if clean != col:
                rename_map[col] = clean

        if rename_map:
            self.df.rename(columns=rename_map, inplace=True)
            self._log(
                action="header_normalisation",
                renamed=rename_map,
                count=len(rename_map),
            )

    # ──────────────────────────────────────────
    # Step 2 — String normalisation
    # ──────────────────────────────────────────

    def normalise_strings(self) -> None:
        """
        For every object column:
          - Decode unicode noise (\\xa0, zero-width spaces, etc.)
          - Strip control characters (\\r \\n \\t)
          - Collapse internal whitespace
          - Strip leading/trailing whitespace
          - Lowercase
          - Replace known placeholder strings with NaN
        """
        object_cols = self.df.select_dtypes(include="object").columns
        for col in object_cols:
            before_nulls = int(self.df[col].isna().sum())
            s = self.df[col].astype(str)

            # Unicode noise
            s = s.str.replace(u"\xa0", " ", regex=False)    # non-breaking space
            s = s.str.replace(u"\u200b", "", regex=False)   # zero-width space
            s = s.str.replace(u"\ufeff", "", regex=False)   # BOM

            # Control characters
            s = s.str.replace(r"[\r\n\t\x00-\x1f\x7f]", " ", regex=True)

            # Whitespace
            s = s.str.strip()
            s = s.str.replace(r"\s+", " ", regex=True)

            # Lowercase
            s = s.str.lower()

            # Placeholder -> NaN
            s = s.apply(lambda x: np.nan if x in PLACEHOLDER_VALUES else x)

            self.df[col] = s
            after_nulls = int(self.df[col].isna().sum())
            new_nulls = after_nulls - before_nulls

            self._log(
                action="string_normalisation",
                column=col,
                placeholders_nulled=new_nulls,
            )

    # ──────────────────────────────────────────
    # Step 3 — Unit stripping
    # ──────────────────────────────────────────

    def strip_units(self) -> None:
        """
        Remove common measurement suffixes from object columns so that
        numeric parsing succeeds downstream.
        E.g. "142.5 sq.m." -> "142.5",  "4,500 kg" -> "4500"
        Patterns live in utils.UNIT_PATTERNS so they are easy to extend.
        """
        object_cols = self.df.select_dtypes(include="object").columns
        for col in object_cols:
            original = self.df[col].copy()
            s = self.df[col].astype(str)
            for pattern in UNIT_PATTERNS:
                s = s.str.replace(pattern, "", regex=True)
            s = s.str.strip()
            changed = int((s != original.astype(str)).sum())
            if changed:
                self.df[col] = s
                self._log(
                    action="unit_stripping",
                    column=col,
                    cells_affected=changed,
                )

    # ──────────────────────────────────────────
    # Step 4 — Category harmonisation
    # ──────────────────────────────────────────

    def harmonise_categories(self) -> None:
        """
        Map abbreviations and variants to canonical forms.
        Uses ABBREVIATION_MAPS from utils (extend there, not here).
        E.g. "terr." -> "terraced",  "semi" -> "semi-detached"

        Also applies user-supplied config.category_maps if provided:
          config.category_maps = {"house_type": {"det": "detached", ...}}
        """
        for col in self.df.select_dtypes(include=["object", "category"]).columns:
            s = self.df[col]
            changed_total = 0

            for abbrev_map in ABBREVIATION_MAPS:
                before = s.copy()
                s = s.replace(abbrev_map)
                changed_total += int((s != before).sum())

            user_maps: dict = getattr(self.config, "category_maps", {}) or {}
            if col in user_maps:
                before = s.copy()
                s = s.replace(user_maps[col])
                changed_total += int((s != before).sum())

            if changed_total:
                self.df[col] = s
                self._log(
                    action="category_harmonisation",
                    column=col,
                    cells_remapped=changed_total,
                )

    # ──────────────────────────────────────────
    # Step 5 — Duplicate removal
    # ──────────────────────────────────────────

    def remove_duplicates(self) -> None:
        before = len(self.df)
        self.df.drop_duplicates(inplace=True)
        self.df.reset_index(drop=True, inplace=True)
        removed = before - len(self.df)
        if removed:
            self._log(
                action="duplicate_removal",
                rows_removed=removed,
                pct_removed=_pct(removed, before),
            )

    # ──────────────────────────────────────────
    # Step 6 — Type inference
    # ──────────────────────────────────────────

    def _infer_type(self, series: pd.Series) -> tuple[str, pd.Series, float | None]:
        """
        Returns (type_string, converted_series, confidence).
        Priority: numeric -> datetime -> boolean -> categorical.
        Confidence = ratio of successfully converted non-null values.
        """
        non_null = series.dropna()
        if non_null.empty:
            return "categorical", series, None

        # ── Datetime (check BEFORE numeric — date strings contain digits) ──
        # Use a strict format list to avoid false positives and suppress warnings
        DATE_FORMATS = [
            "%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y",
            "%d-%m-%Y", "%Y/%m/%d", "%d %b %Y",
            "%d %B %Y", "%b %d, %Y", "%B %d, %Y",
            "%b %d %Y", "%B %d %Y",
        ]
        date_try = None
        date_ratio = 0.0
        str_sample = non_null.astype(str)
        # Quick gate: passes numeric-separator dates AND month-name dates
        # e.g. 2021-10-19, 22/03/2022, Jul 1, 2004, Aug 30, 2015
        _numeric_date  = r"\d{2,4}[-/\s]\d{1,2}[-/\s]\d{2,4}"
        _monthname_date = r"(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2}"
        looks_like_date = str_sample.str.contains(
            rf"(?:{_numeric_date}|{_monthname_date})", regex=True, case=False
        ).mean()
        if looks_like_date >= 0.5:
            for fmt in DATE_FORMATS:
                try:
                    dt = pd.to_datetime(series, format=fmt, errors="coerce")
                    ratio = dt.notna().sum() / max(len(non_null), 1)
                    if ratio > date_ratio:
                        date_ratio = ratio
                        date_try = dt
                except Exception:
                    continue
        if date_ratio >= self.config.datetime_confidence:
            return "datetime", date_try, round(date_ratio, 4)

        # ── Numeric ──
        numeric_try = sanitize_numeric(series)
        numeric_ratio = numeric_try.notna().sum() / max(len(non_null), 1)
        if numeric_ratio >= self.config.numeric_confidence_weak:
            return "numeric", numeric_try, round(numeric_ratio, 4)

        # ── Boolean ──
        bool_map = {
            "true": True,  "false": False,
            "yes":  True,  "no":    False,
            "1":    True,  "0":     False,
            "y":    True,  "n":     False,
        }
        bool_try = non_null.astype(str).str.lower().map(bool_map)
        bool_ratio = bool_try.notna().sum() / max(len(non_null), 1)
        if bool_ratio >= 0.95:
            full_bool = series.astype(str).str.lower().map(bool_map)
            return "boolean", full_bool, round(bool_ratio, 4)

        return "categorical", series, None

    # ──────────────────────────────────────────
    # Quality scoring
    # ──────────────────────────────────────────

    def _quality_score(
        self,
        series: pd.Series,
        conversion_ratio: float | None,
        outlier_ratio: float = 0.0,
    ) -> float:
        """
        Weighted score:
          Completeness (non-null ratio)      weight 0.50
          Consistency  (type conversion %)   weight 0.35
          Validity     (1 - outlier ratio)   weight 0.15
        """
        completeness = 1 - series.isna().mean()
        consistency  = conversion_ratio if conversion_ratio is not None else 1.0
        validity     = 1.0 - outlier_ratio
        return round(0.50 * completeness + 0.35 * consistency + 0.15 * validity, 4)

    # ──────────────────────────────────────────
    # Outlier handling
    # ──────────────────────────────────────────

    def _handle_outliers(self, col: str) -> float:
        """
        Detect and act on outliers. Returns outlier ratio for quality scoring.
        config.outlier_action options:
          'none'   - detect and log only, no mutation (default)
          'flag'   - add <col>_is_outlier boolean column (explicit user choice)
          'cap'    - Winsorise to [Q1 - k*IQR, Q3 + k*IQR]
          'remove' - drop outlier rows
        Outlier counts always appear in the audit log and quality scores
        regardless of action — only DataFrame mutation differs.
        """
        series = self.df[col].dropna()
        if series.empty:
            return 0.0

        method = getattr(self.config, "outlier_method", "iqr")
        if method == "zscore":
            mask = detect_outliers_zscore(self.df[col], self.config.outlier_zscore_threshold)
        else:
            mask = detect_outliers_iqr(self.df[col], self.config.outlier_iqr_multiplier)

        count = int(mask.sum())
        if count == 0:
            return 0.0

        outlier_ratio = count / len(self.df)
        action = getattr(self.config, "outlier_action", "none")

        if action == "flag":
            flag_col = f"{col}_is_outlier"
            self.df[flag_col] = mask
            self._log(action="outlier_flagged", column=col, count=count,
                      flag_column=flag_col, pct=_pct(count, len(self.df)))

        elif action == "cap":
            q1 = self.df[col].quantile(0.25)
            q3 = self.df[col].quantile(0.75)
            iqr = q3 - q1
            lower = q1 - self.config.outlier_iqr_multiplier * iqr
            upper = q3 + self.config.outlier_iqr_multiplier * iqr
            self.df[col] = self.df[col].clip(lower=lower, upper=upper)
            self._log(action="outlier_capped", column=col, count=count,
                      lower=round(lower, 4), upper=round(upper, 4))

        elif action == "remove":
            before = len(self.df)
            self.df = self.df[~mask].reset_index(drop=True)
            self._log(action="outlier_rows_removed", column=col,
                      rows_dropped=before - len(self.df))

        else:
            self._log(action="outlier_detected", column=col, count=count,
                      pct=_pct(count, len(self.df)))

        return outlier_ratio

    # ──────────────────────────────────────────
    # Per-type processors
    # ──────────────────────────────────────────

    def _process_numeric(self, col: str, converted: pd.Series, confidence: float) -> None:
        self.df[col] = converted
        missing_ratio = float(self.df[col].isna().mean())

        if missing_ratio > self.config.missing_drop_threshold:
            score = self._quality_score(self.df[col], confidence)
            self.column_quality.append({
                "column": col, "type": "numeric", "quality_score": score,
                "dropped": True, "drop_reason": "excessive_missing",
                "missing_pct": round(missing_ratio * 100, 1),
            })
            self.df.drop(columns=[col], inplace=True)
            self._log(action="column_dropped", column=col,
                      reason="excessive_missing",
                      missing_pct=round(missing_ratio * 100, 1))
            return

        strategy = self.config.impute_numeric_strategy
        if strategy == "median":
            fill_value = round(float(self.df[col].median()), 4)
        elif strategy == "mean":
            fill_value = round(float(self.df[col].mean()), 4)
        elif strategy == "zero":
            fill_value = 0.0
        else:
            fill_value = round(float(self.df[col].median()), 4)

        n_imputed = int(self.df[col].isna().sum())
        self.df[col] = self.df[col].fillna(fill_value)
        if n_imputed:
            self._log(action="numeric_imputation", column=col,
                      method=strategy, fill_value=fill_value,
                      cells_filled=n_imputed,
                      pct_filled=_pct(n_imputed, len(self.df)))

        outlier_ratio = self._handle_outliers(col)
        score = self._quality_score(self.df[col], confidence, outlier_ratio)
        self.column_quality.append({
            "column": col, "type": "numeric", "quality_score": score,
            "dropped": False,
            "missing_pct": round(missing_ratio * 100, 1),
            "outlier_pct": round(outlier_ratio * 100, 1),
            "imputation_method": strategy,
        })

    def _process_datetime(self, col: str, converted: pd.Series, confidence: float) -> None:
        self.df[col] = converted
        missing_ratio = float(self.df[col].isna().mean())

        if missing_ratio > self.config.missing_drop_threshold:
            score = self._quality_score(self.df[col], confidence)
            self.column_quality.append({
                "column": col, "type": "datetime", "quality_score": score,
                "dropped": True, "drop_reason": "excessive_missing",
            })
            self.df.drop(columns=[col], inplace=True)
            self._log(action="column_dropped", column=col, reason="excessive_missing")
            return

        n_missing = int(self.df[col].isna().sum())
        if n_missing:
            strategy = getattr(self.config, "impute_datetime_strategy", "median")
            if strategy == "median":
                numeric_ts = pd.to_numeric(self.df[col], errors="coerce")
                fill_dt = pd.Timestamp(numeric_ts.median())
            elif strategy == "min":
                fill_dt = self.df[col].min()
            elif strategy == "max":
                fill_dt = self.df[col].max()
            else:
                fill_dt = pd.Timestamp(
                    getattr(self.config, "datetime_fill_value", "2000-01-01"))
            self.df[col] = self.df[col].fillna(fill_dt)
            self._log(action="datetime_imputation", column=col,
                      fill_value=str(fill_dt), cells_filled=n_missing)

        score = self._quality_score(self.df[col], confidence)
        self.column_quality.append({
            "column": col, "type": "datetime", "quality_score": score,
            "dropped": False, "missing_pct": round(missing_ratio * 100, 1),
        })

    def _process_boolean(self, col: str, converted: pd.Series, confidence: float) -> None:
        self.df[col] = converted
        n_missing = int(self.df[col].isna().sum())
        if n_missing:
            fill = _safe_mode(self.df[col])
            self.df[col] = self.df[col].fillna(fill)
            self._log(action="boolean_imputation", column=col,
                      fill_value=fill, cells_filled=n_missing)
        score = self._quality_score(self.df[col], confidence)
        self.column_quality.append({
            "column": col, "type": "boolean",
            "quality_score": score, "dropped": False,
        })

    def _process_categorical(self, col: str, series: pd.Series) -> None:
        missing_ratio = float(series.isna().mean())

        if missing_ratio > self.config.missing_drop_threshold:
            self.column_quality.append({
                "column": col, "type": "categorical",
                "quality_score": round(1 - missing_ratio, 4),
                "dropped": True, "drop_reason": "excessive_missing",
            })
            self.df.drop(columns=[col], inplace=True)
            self._log(action="column_dropped", column=col,
                      reason="excessive_missing",
                      missing_pct=round(missing_ratio * 100, 1))
            return

        self.df[col] = series.astype("category")

        n_missing = int(self.df[col].isna().sum())
        if n_missing and self.config.impute_categorical_strategy == "mode":
            fill = _safe_mode(self.df[col])
            if pd.notna(fill):
                if fill not in self.df[col].cat.categories:
                    self.df[col] = self.df[col].cat.add_categories([fill])
                self.df[col] = self.df[col].fillna(fill)
                self._log(action="categorical_imputation", column=col,
                          method="mode", fill_value=str(fill),
                          cells_filled=n_missing)

        n_unique = self.df[col].nunique()
        cardinality_ratio = n_unique / max(len(self.df), 1)
        self.column_quality.append({
            "column": col, "type": "categorical",
            "quality_score": round(1 - missing_ratio, 4),
            "dropped": False,
            "missing_pct": round(missing_ratio * 100, 1),
            "unique_values": n_unique,
            "cardinality_ratio": round(cardinality_ratio, 4),
            "high_cardinality_warning": cardinality_ratio > 0.5,
        })

    # Patterns that strongly suggest a column is an identifier
    _ID_COLUMN_NAME_PATTERN = re.compile(
        r"\b(id|ids|uuid|guid|key|code|ref|num|no|number|serial|sku|barcode|hash)\b",
        re.IGNORECASE,
    )
    # URL column name patterns
    _URL_COLUMN_NAME_PATTERN = re.compile(
        r"\b(url|link|href|uri|photo|image|img|avatar|thumbnail|src)\b",
        re.IGNORECASE,
    )

    def _is_id_column(self, col: str, series: pd.Series) -> bool:
        """
        Returns True if the column should be treated as an identifier object.
        Two signals, either is sufficient:
          1. Column name contains ID-like keywords (id, ref, code, uuid, etc.)
          2. Values are all unique integers with no analytical spread
             (pure row identifiers like FIFA's ID column: 158023, 20801...)
        """
        # Signal 1 — column name
        col_clean = col.replace("_", " ").replace("-", " ")
        if self._ID_COLUMN_NAME_PATTERN.search(col_clean):
            return True

        # Signal 2 — URL-named columns (photoUrl, playerUrl)
        if self._URL_COLUMN_NAME_PATTERN.search(col_clean):
            return True

        # Signal 3 — all-unique integer values in a large enough dataset
        # (e.g. FIFA ID: 158023, 20801 — looks numeric but is a row key)
        # Requires >= 50 rows to avoid misfiring on small datasets where
        # legitimate columns like Age or Score happen to all be unique.
        non_null = series.dropna()
        if len(non_null) >= 50:
            try:
                as_num = pd.to_numeric(non_null, errors="coerce")
                if as_num.notna().all():
                    all_integers = (as_num == as_num.round()).all()
                    all_unique   = as_num.nunique() == len(as_num)
                    if all_integers and all_unique:
                        return True
            except Exception:
                pass

        return False

    def process_column(self, col: str) -> None:
        if col not in self.df.columns:
            return  # already dropped upstream
        series = self.df[col]

        # ── ID / URL columns → force categorical, skip type inference ──
        if self._is_id_column(col, series):
            self.df[col] = series.astype(str).str.strip().str.lower()
            self.df[col] = self.df[col].astype("category")
            n_unique = self.df[col].nunique()
            self.column_quality.append({
                "column": col, "type": "categorical",
                "quality_score": 1.0,
                "dropped": False,
                "missing_pct": 0.0,
                "unique_values": n_unique,
                "cardinality_ratio": round(n_unique / max(len(self.df), 1), 4),
                "high_cardinality_warning": True,
                "imputation_method": None,
            })
            self._log(action="id_column_forced_categorical", column=col,
                      unique_values=n_unique)
            return

        inferred_type, converted, confidence = self._infer_type(series)

        dispatch = {
            "numeric":     lambda: self._process_numeric(col, converted, confidence),
            "datetime":    lambda: self._process_datetime(col, converted, confidence),
            "boolean":     lambda: self._process_boolean(col, converted, confidence),
            "categorical": lambda: self._process_categorical(col, series),
        }
        dispatch[inferred_type]()

    # ──────────────────────────────────────────
    # Step 7 — Low variance flagging
    # ──────────────────────────────────────────

    def flag_low_variance_columns(self) -> None:
        """
        Flag constant columns (1 unique value) and near-constant columns
        (one value dominates above config.low_variance_threshold).
        Logged only — caller decides whether to drop.
        """
        threshold = getattr(self.config, "low_variance_threshold", 0.98)
        for col in self.df.columns:
            if col.endswith("_is_outlier"):
                continue
            n_unique = self.df[col].nunique(dropna=True)
            if n_unique <= 1:
                self._log(action="constant_column_flagged",
                          column=col, unique_values=n_unique)
                continue
            top_freq = (
                self.df[col]
                .value_counts(normalize=True, dropna=True)
                .iloc[0]
            )
            if top_freq >= threshold:
                self._log(action="near_constant_column_flagged",
                          column=col,
                          dominant_value_pct=round(top_freq * 100, 1))

    # ──────────────────────────────────────────
    # Step 8 — EDA report
    # ──────────────────────────────────────────

    def generate_eda(self) -> dict:
        numeric_df = self.df.select_dtypes(include=np.number)
        cat_df     = self.df.select_dtypes(include="category")

        # Shapiro-Wilk normality test + skew/kurtosis per numeric col
        distributions: dict = {}
        for col in numeric_df.columns:
            s = numeric_df[col].dropna()
            if len(s) < 3:
                continue
            skew = round(float(s.skew()), 4)
            kurt = round(float(s.kurt()), 4)
            sample = s.sample(min(len(s), 5000), random_state=42)
            _, p_val = scipy_stats.shapiro(sample)
            distributions[col] = {
                "skewness":          skew,
                "kurtosis":          kurt,
                "normality_p_value": round(float(p_val), 6),
                "is_normal":         bool(p_val > 0.05),
            }

        # Top-10 value counts per categorical col
        value_counts: dict = {}
        for col in cat_df.columns:
            value_counts[col] = (
                self.df[col]
                .value_counts(dropna=False)
                .head(10)
                .to_dict()
            )

        return {
            "shape":                list(self.df.shape),
            "original_shape":       list(self.original_df.shape),
            "rows_removed":         self._total_rows - len(self.df),
            "summary_statistics":   numeric_df.describe().round(4).to_dict(),
            "missing_values":       self.df.isna().sum().to_dict(),
            "missing_pct":          (self.df.isna().mean() * 100).round(2).to_dict(),
            "correlation_matrix":   numeric_df.corr().round(4).to_dict(),
            "distributions":        distributions,
            "value_counts":         value_counts,
            "dtypes":               {col: str(dt) for col, dt in self.df.dtypes.items()},
            "column_count_by_type": {
                "numeric":   len(numeric_df.columns),
                "categorical": len(cat_df.columns),
                "datetime":  len(self.df.select_dtypes(include="datetime").columns),
                "boolean":   len(self.df.select_dtypes(include="bool").columns),
            },
        }

    # ──────────────────────────────────────────
    # Public runner
    # ──────────────────────────────────────────

    def run(self) -> dict:
        """Execute the full pipeline and return structured results."""
        self._log(action="pipeline_started",
                  input_shape=list(self.original_df.shape),
                  config=self.config.__dict__)

        self.normalise_column_headers()
        self.normalise_strings()
        self.strip_units()
        self.harmonise_categories()
        self.remove_duplicates()

        for col in list(self.df.columns):
            self.process_column(col)

        self.flag_low_variance_columns()
        eda = self.generate_eda()

        duration = (datetime.utcnow() - self._started_at).total_seconds()
        self._log(action="pipeline_complete",
                  output_shape=list(self.df.shape),
                  columns_dropped=(
                      len(self.original_df.columns) - len(self.df.columns)
                  ),
                  duration_seconds=round(duration, 3))

        return {
            "cleaned_dataframe":      self.df,
            "audit_log":              self.audit_log,
            "column_quality_summary": self.column_quality,
            "eda_report":             eda,
        }