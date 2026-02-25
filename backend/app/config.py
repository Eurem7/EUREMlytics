"""
config.py
=========
All cleaning thresholds and strategies in one place.
Pass a customised CleaningConfig to EnterpriseDataEngine to override defaults.

Example:
    config = CleaningConfig(
        impute_numeric_strategy="mean",
        outlier_action="cap",
        category_maps={"house_type": {"det": "detached"}},
    )
"""

from dataclasses import dataclass, field


@dataclass
class CleaningConfig:

    # ── Type inference ──────────────────────────────────────────
    # Minimum ratio of non-null values that must parse successfully
    # for a column to be treated as numeric.
    numeric_confidence_strong: float = 0.85   # reserved for future use / reporting
    numeric_confidence_weak:   float = 0.60   # threshold used in inference

    # Minimum ratio for datetime inference
    datetime_confidence: float = 0.85

    # ── Missing value handling ───────────────────────────────────
    # Columns with a missing ratio above this threshold are dropped entirely
    missing_drop_threshold: float = 0.60

    # How to fill missing numeric values: "median" | "mean" | "zero"
    impute_numeric_strategy: str = "median"

    # How to fill missing categorical values: "mode" | "none"
    impute_categorical_strategy: str = "mode"

    # How to fill missing datetime values: "median" | "min" | "max" | "fixed"
    impute_datetime_strategy: str = "median"

    # Used only when impute_datetime_strategy == "fixed"
    datetime_fill_value: str = "2000-01-01"

    # ── Outlier handling ─────────────────────────────────────────
    # Detection method: "iqr" | "zscore"
    outlier_method: str = "iqr"

    # IQR multiplier (standard = 1.5, conservative = 3.0)
    outlier_iqr_multiplier: float = 1.5

    # Z-score threshold (standard = 3.0)
    outlier_zscore_threshold: float = 3.0

    # What to do with detected outliers:
    #   "none"   → detect and log only, no mutation (default — clean output)
    #   "flag"   → add <col>_is_outlier boolean column (explicit user choice)
    #   "cap"    → Winsorise values to [lower, upper] bounds
    #   "remove" → drop outlier rows from the DataFrame
    outlier_action: str = "none"

    # ── Low variance ─────────────────────────────────────────────
    # Columns where one value appears in >= this fraction of rows
    # are logged as near-constant (not auto-dropped)
    low_variance_threshold: float = 0.98

    # ── Category harmonisation ───────────────────────────────────
    # Per-column abbreviation maps applied on top of the built-in ones.
    # Format: {"column_name": {"abbreviation": "canonical_form", ...}}
    # E.g.: {"house_type": {"det.": "detached", "terr": "terraced"}}
    category_maps: dict = field(default_factory=dict)