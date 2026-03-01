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
    # Numeric placeholders
    "inf", "infinity", "nan", "#value!", "n.a.", "n.a",
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
    # Nigerian city/state abbreviations
    {
        "ph":              "port harcourt",
        "phc":             "port harcourt",
        "p.h":             "port harcourt",
        "p.h.c":           "port harcourt",
        "fct":             "abuja",
        "abj":             "abuja",
        "lag":             "lagos",
        "ikeja":           "lagos",
        "vi":              "lagos",
        "v.i":             "lagos",
        "lekki":           "lagos",
        "aba":             "aba",
        "enugu":           "enugu",
        "kano":            "kano",
        "ibadan":          "ibadan",
        "benin":           "benin city",
        "benin city":      "benin city",
        "warri":           "warri",
        "calabar":         "calabar",
        "uyo":             "uyo",
        "jos":             "jos",
        "kaduna":          "kaduna",
        "maiduguri":       "maiduguri",
        "zaria":           "zaria",
        "ilorin":          "ilorin",
        "onitsha":         "onitsha",
        "owerri":          "owerri",
        "asaba":           "asaba",
        "yola":            "yola",
        "bauchi":          "bauchi",
        "gombe":           "gombe",
        "makurdi":         "makurdi",
        "lokoja":          "lokoja",
        "akure":           "akure",
        "ado ekiti":       "ado-ekiti",
        "ado-ekiti":       "ado-ekiti",
        "osogbo":          "osogbo",
        "abeokuta":        "abeokuta",
    },
    # Country name normalisation
    {
        "us":            "usa",
        "us.":           "usa",
        "u.s.":          "usa",
        "u.s.a.":        "usa",
        "united states": "usa",
        "uk":            "uk",
        "u.k.":          "uk",
        "united kingdom":"uk",
        "great britain": "uk",
        "gb":            "uk",
        "new zesland":   "new zealand",
        "new zeland":    "new zealand",
        "nz":            "new zealand",
        "italy1":        "italy",
        "italia":        "italy",
        "south korea":   "south korea",
        "korea":         "south korea",
        "west germany":  "germany",
        "deutschland":   "germany",
        "fr":            "france",
        "jp":            "japan",
        "in":            "india",
    },
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

    # Boolean variants
    {
        "true":    "true",
        "false":   "false",
        "yes":     "true",
        "no":      "false",
        "1":       "true",
        "0":       "false",
        "on":      "true",
        "off":     "false",
        "active":  "active",
        "inactive":"inactive",
        "✓":       "true",
        "✗":       "false",
        "✘":       "false",
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

def _is_european_thousands(val: str) -> bool:
    """
    Detect European dot-thousands format: 2.278.845, 1.572.674
    Pattern: digits separated by exactly 3 digits after each dot, multiple times.
    """
    return bool(re.match(r"^\d{1,3}(?:\.\d{3})+$", val.strip()))


def _fix_european_thousands(val: str) -> str:
    """Convert European dot-thousands 2.278.845 → 2278845"""
    return val.replace(".", "")


def _fix_score_corruption(val: str) -> str:
    """
    Fix common score/rating corruptions:
      8,9f  → 8.9    (comma decimal + trailing char)
      8:8   → 8.8    (colon as decimal)
      8..8  → 8.8    (double dot)
      8,7e-0 → 8.7   (comma decimal + scientific suffix)
      ++8.7 → 8.7    (leading junk)
      8.7.  → 8.7    (trailing dot)
      9,.0  → 9.0    (comma+dot mixed)
    """
    s = val.strip()
    # Strip leading non-digit/minus chars
    s = re.sub(r"^[^\d\-]+", "", s)
    # Replace colon used as decimal: 8:8 -> 8.8
    s = re.sub(r"(\d):(\d)", r"\1.\2", s)
    # Replace double dot: 8..8 -> 8.8
    s = re.sub(r"(\d)\.\.(\d)", r"\1.\2", s)
    # Replace comma decimal: 8,9 -> 8.9 (only if followed by 1-2 digits then end/non-digit)
    s = re.sub(r"(\d),(\d{1,2})([^\d]|$)", r"\1.\2\3", s)
    # Remove trailing non-numeric chars (8.7., 8,9f)
    s = re.sub(r"[^\d\.]+$", "", s)
    # Remove comma+dot combos: 9,.0 -> 9.0
    s = re.sub(r",\.", ".", s)
    return s


def sanitize_numeric(series: pd.Series) -> pd.Series:
    """
    Strip currency symbols, thousands separators, unit suffixes, and
    expand K/M/B multipliers, then extract the first valid numeric token.

    Returns a float64 Series with NaN where no number was found.

    Guards (applied to original string before any stripping):
      - ID-style strings   (REF-1234, SKU_001)         → NaN
      - Date-like strings  (2021-10-19, 22/03/2022)    → NaN
      - Range strings      (2004 ~ 2021, 100 - 200)    → NaN
      - Month-name dates   (Jul 1, 2004, Aug 30, 2015) → NaN

    Special handling:
      - European dot thousands: 2.278.845  → 2278845
      - European comma decimal: 8,9        → 8.9
      - Score corruptions:      8:8, 8..8, ++8.7 → 8.8, 8.8, 8.7
      - OCR letter-o:           4o8,035    → 408035
      - Multipliers:            €103.5M    → 103500000
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

    # ── Strip currency symbols + leading whitespace after symbol ──
    s = s.str.replace(r"[₦\$€£¥₹₩₪฿]\s*", "", regex=True)

    # ── OCR fix: letter o/O used as zero in numeric context ──
    # e.g. "4o8,035,783" → "408,035,783"
    s = s.apply(lambda v: re.sub(r"(?<=\d)[oO](?=\d)", "0", v) if isinstance(v, str) else v)

    # ── European dot thousands: 2.278.845 → 2278845 ──
    # Must be done BEFORE general dot handling
    s = s.apply(lambda v: _fix_european_thousands(v) if isinstance(v, str) and _is_european_thousands(v) else v)

    # ── Thousands commas: 1,234,567 → 1234567 ──
    s = s.str.replace(r",(?=\d{3})", "", regex=True)

    # ── Score/rating corruption fixes ──
    s = s.apply(lambda v: _fix_score_corruption(v) if isinstance(v, str) else v)

    # ── Common unit suffixes ──
    s = s.str.replace(r"\s*(sq\.?m\.?|sqm|cm|kg|lbs?|%|pcs?)\s*", "", regex=True)

    # ── Star ratings ──
    s = s.str.replace(r"\s*★\s*", "", regex=True)

    # ── Extract first valid numeric token ──
    extracted = s.str.extract(r"(?:^|(?<=\s))([-]?\d+\.?\d*)", expand=False)
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


# ─────────────────────────────────────────────────────────────
# Phone number normalisation
# ─────────────────────────────────────────────────────────────

_PHONE_STRIP = re.compile(r"[\s\-\.\(\)]+")
_NIGERIAN_MOBILE = re.compile(r"^(?:\+?234|0)(7|8|9)\d{9}$")

def normalise_phone(series: pd.Series) -> pd.Series:
    """
    Normalise Nigerian phone numbers to 11-digit local format (080xxxxxxxx).
    - Strips spaces, dashes, dots, brackets
    - Converts +234xxxxxxxxx → 0xxxxxxxxx
    - Returns original value if it doesn't look like a phone number
    """
    def _fix(val):
        if not isinstance(val, str):
            return val
        clean = _PHONE_STRIP.sub("", val)
        # +2348012345678 → 08012345678
        if clean.startswith("+234") and len(clean) == 14:
            clean = "0" + clean[4:]
        # 2348012345678 → 08012345678
        elif clean.startswith("234") and len(clean) == 13:
            clean = "0" + clean[3:]
        if _NIGERIAN_MOBILE.match(clean):
            return clean
        return val  # not a recognised phone — return as-is
    return series.apply(_fix)


# ─────────────────────────────────────────────────────────────
# Percentage normalisation
# ─────────────────────────────────────────────────────────────

def normalise_percentage(series: pd.Series) -> tuple[pd.Series, bool]:
    """
    Detect and normalise percentage columns.
    Returns (normalised_series, was_percentage_column).

    Handles:
      "45%"  → 0.45
      "45"   → 0.45  (if all values 0-100 and column name has % hint)
      "0.45" → 0.45  (already decimal form)
    """
    s = series.astype(str).str.strip()
    has_pct_sign = s.str.endswith("%").any()

    if not has_pct_sign:
        return series, False

    def _to_decimal(val):
        if not isinstance(val, str):
            return val
        val = val.strip()
        if val.endswith("%"):
            try:
                return float(val[:-1]) / 100
            except ValueError:
                return np.nan
        try:
            return float(val)
        except ValueError:
            return np.nan

    return series.apply(_to_decimal), True


# ─────────────────────────────────────────────────────────────
# High-cardinality / free-text detection
# ─────────────────────────────────────────────────────────────

def is_free_text_column(series: pd.Series) -> bool:
    """
    Detect if a column is free-text (address, description, notes)
    rather than a true categorical.

    Signals:
      - Unique ratio > 0.7 (most values are unique)
      - Average word count > 3
      - Column name contains address/description/notes/comment keywords
    """
    non_null = series.dropna().astype(str)
    if len(non_null) == 0:
        return False
    unique_ratio = non_null.nunique() / len(non_null)
    avg_words    = non_null.str.split().str.len().mean()
    return unique_ratio > 0.7 and avg_words > 3
