"""
utils.py
========
Shared constants and helper functions for the cleaning pipeline.
Extend PLACEHOLDER_VALUES, UNIT_PATTERNS, and ABBREVIATION_MAPS here —
the engine reads them automatically, no engine changes needed.
"""

import re
import numpy as np
import pandas as pd


# ─────────────────────────────────────────────────────────────
# Placeholder / null-equivalent strings
# All values are already lowercased (engine lowercases before checking)
# ─────────────────────────────────────────────────────────────
PLACEHOLDER_VALUES: set[str] = {
    # Empty / whitespace
    "", " ", "  ",
    # Explicit null words
    "na", "n/a", "n/ a", "null", "none", "nil",
    # Unknown
    "unknown", "unk", "?", "??",
    # Dash variants
    "-", "--", "---", "–", "—",
    # Excel / spreadsheet noise
    "#n/a", "#na", "#null!", "#####", "div/0", "#div/0!",
    # String versions of nan/nat
    "nan", "nat",
    # Misc
    "not available", "not applicable", "tbd", "tba", "missing",
}


# ─────────────────────────────────────────────────────────────
# Unit / suffix patterns to strip before numeric parsing
# Each is a regex string applied via str.replace(..., regex=True)
# ─────────────────────────────────────────────────────────────
UNIT_PATTERNS: list[str] = [
    # Currency symbols (prefix or suffix)
    r"[₦\$€£¥₹₩₪฿]",
    # Area
    r"\bsq\.?\s*m\.?\b",
    r"\bsq\.?\s*ft\.?\b",
    r"\bsqm\b",
    r"\bsqft\b",
    r"\bm²\b",
    r"\bft²\b",
    # Weight / volume
    r"\bkg\b",
    r"\bg\b",
    r"\blbs?\b",
    r"\boz\b",
    r"\blitres?\b",
    r"\bml\b",
    r"\bL\b",
    # Percentage (keeps the number)
    r"%",
    # Common suffixes in business data
    r"\bpcs?\b",
    r"\bunits?\b",
    r"\bhrs?\b",
    r"\bdays?\b",
    # Commas as thousands separators
    r"(?<=\d),(?=\d{3})",
]


# ─────────────────────────────────────────────────────────────
# Abbreviation / variant maps
# Each dict maps lowercase variant -> canonical lowercase form.
# Add domain-specific maps as new dicts in this list.
# ─────────────────────────────────────────────────────────────
ABBREVIATION_MAPS: list[dict[str, str]] = [
    # Property / house types
    {
        "terr.":           "terraced",
        "terr":            "terraced",
        "terraced house":  "terraced",
        "semi":            "semi-detached",
        "semi-det":        "semi-detached",
        "semi det":        "semi-detached",
        "s/d":             "semi-detached",
        "det.":            "detached",
        "det":             "detached",
        "detached house":  "detached",
        "flat/apartment":  "flat",
        "apt":             "flat",
        "apartment":       "flat",
        "bungalow house":  "bungalow",
    },
    # Gender
    {
        "m":    "male",
        "f":    "female",
        "fem":  "female",
        "mal":  "male",
    },
    # Boolean-ish categoricals
    {
        "y":    "yes",
        "n":    "no",
        "yep":  "yes",
        "nope": "no",
    },
    # Employment status
    {
        "ft":         "full-time",
        "pt":         "part-time",
        "f/t":        "full-time",
        "p/t":        "part-time",
        "self emp":   "self-employed",
        "self-emp":   "self-employed",
        "unemployed": "unemployed",
    },
]


# ─────────────────────────────────────────────────────────────
# Pre-compiled guard patterns for sanitize_numeric
# ─────────────────────────────────────────────────────────────

# ID-style strings: REF-1234, SKU_001, TXN#9999, ORD-ABC-99
_ID_PATTERN = re.compile(r"^[A-Za-z#][A-Za-z0-9]*[\-_#:/\.][A-Za-z0-9\-_]+$")

# Date-like strings: 2021-10-19, 22/03/2022
_DATE_PATTERN = re.compile(r"^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}")

# Range strings: "2004 ~ 2021", "100 - 200", "Jan ~ Dec"
# These contain a separator with spaces on both sides — never numeric
_RANGE_PATTERN = re.compile(r".+\s[~\-–—to]\s.+")

# Month-name dates: "Jul 1, 2004", "Aug 30, 2015", "Jan 1, 2020"
# sanitize_numeric would grab the day digit — should return NaN
_MONTH_DATE_PATTERN = re.compile(
    r"^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b",
    re.IGNORECASE,
)


# ─────────────────────────────────────────────────────────────
# Multiplier helpers for M / K / B suffixes
# ─────────────────────────────────────────────────────────────

_MULTIPLIER_PATTERN = re.compile(
    r"([-+]?\d*\.?\d+)\s*([KkMmBb])\b"
)

_MULTIPLIER_MAP = {
    "k": 1_000,
    "m": 1_000_000,
    "b": 1_000_000_000,
}


def _expand_multipliers(s: pd.Series) -> pd.Series:
    """
    Convert shorthand like €103.5M → 103500000, €560K → 560000, €1.2B → 1200000000.
    Applied before generic stripping so the suffix is consumed correctly.
    """
    def _expand(val) -> str:
        if not isinstance(val, str):
            return val
        match = _MULTIPLIER_PATTERN.search(val)
        if match:
            number = float(match.group(1))
            suffix = match.group(2).lower()
            expanded = int(number * _MULTIPLIER_MAP[suffix])
            # Replace the matched portion with the expanded integer
            return val[:match.start()] + str(expanded) + val[match.end():]
        return val

    return s.apply(_expand)


# ─────────────────────────────────────────────────────────────
# String normalisation helpers
# ─────────────────────────────────────────────────────────────

def strip_control_chars(s: pd.Series) -> pd.Series:
    """
    Remove embedded newlines, tabs and other control characters
    that sneak in when club names etc. are quoted in CSV cells.
    e.g. '\n\n\nFC Barcelona' → 'FC Barcelona'
    """
    return s.str.replace(r"[\r\n\t\x00-\x1f\x7f]", "", regex=True).str.strip()


# ─────────────────────────────────────────────────────────────
# Numeric sanitisation
# ─────────────────────────────────────────────────────────────

def sanitize_numeric(series: pd.Series) -> pd.Series:
    """
    Strip currency symbols, thousands commas, unit suffixes, and
    expand K/M/B multipliers, then extract the first valid numeric token.

    Returns a float64 Series with NaN where no number was found.

    Guards (applied to original string before any stripping):
      - ID-style strings   (REF-1234, SKU_001)         → NaN
      - Date-like strings  (2021-10-19, 22/03/2022)    → NaN
      - Range strings      (2004 ~ 2021, 100 - 200)    → NaN
      - Month-name dates   (Jul 1, 2004, Aug 30, 2015) → NaN

    Multiplier expansion (applied before unit stripping):
      €103.5M → 103500000
      €560K   → 560000
      €1.2B   → 1200000000

    Negative sign handling:
      A leading minus is only treated as numeric when at the start of
      the string or after whitespace — so "REF-1234" → NaN, not -1234.
    """
    s = series.astype(str).str.strip()

    # ── Guards ──
    is_id         = s.str.match(_ID_PATTERN.pattern,         na=False)
    is_date       = s.str.match(_DATE_PATTERN.pattern,       na=False)
    is_range      = s.str.match(_RANGE_PATTERN.pattern,      na=False)
    is_month_date = s.str.match(_MONTH_DATE_PATTERN.pattern, na=False, case=False)

    guard = is_id | is_date | is_range | is_month_date

    # ── Expand K / M / B multipliers ──
    s = _expand_multipliers(s)

    # ── Strip currency symbols ──
    s = s.str.replace(r"[₦\$€£¥₹₩₪฿]", "", regex=True)

    # ── Thousands commas: 1,234,567 → 1234567 ──
    s = s.str.replace(r",(?=\d{3})", "", regex=True)

    # ── Common unit suffixes ──
    s = s.str.replace(r"\s*(sq\.?m\.?|sqm|cm|kg|lbs?|%|pcs?)\s*", "", regex=True)

    # ── Star ratings: strip ★ and surrounding whitespace ──
    s = s.str.replace(r"\s*★\s*", "", regex=True)

    # ── Extract first numeric token ──
    # Leading minus only valid at start-of-string or after whitespace
    extracted = s.str.extract(r"(?:(?<=\s)|^)([-+]?\d*\.?\d+)", expand=False)
    result = pd.to_numeric(extracted, errors="coerce")

    # ── Null out guarded patterns ──
    result[guard] = np.nan

    return result


# ─────────────────────────────────────────────────────────────
# Outlier detection
# ─────────────────────────────────────────────────────────────

def detect_outliers_iqr(series: pd.Series, multiplier: float = 1.5) -> pd.Series:
    """
    IQR method. Returns a boolean Series (True = outlier).
    NaN values are never marked as outliers.

    Bounds:
      lower = Q1 - multiplier * IQR
      upper = Q3 + multiplier * IQR
    Standard multiplier is 1.5; use 3.0 for a more conservative threshold.
    """
    q1 = series.quantile(0.25)
    q3 = series.quantile(0.75)
    iqr = q3 - q1
    lower = q1 - multiplier * iqr
    upper = q3 + multiplier * iqr
    return (series < lower) | (series > upper)


def detect_outliers_zscore(series: pd.Series, threshold: float = 3.0) -> pd.Series:
    """
    Z-score method. Returns a boolean Series (True = outlier).
    NaN values are excluded from mean/std calculation and never flagged.
    A threshold of 3.0 is standard (flags ~0.3% of a normal distribution).
    """
    mean = series.mean()
    std  = series.std()
    if std == 0:
        return pd.Series(False, index=series.index)
    z_scores = (series - mean).abs() / std
    return z_scores > threshold