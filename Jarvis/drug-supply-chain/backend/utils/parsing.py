from typing import Any, Optional


def safe_float(value: Any, default: float = 0.0) -> float:
    """Defensive float conversion — never raises on bad sensor data."""
    if value is None:
        return default
    try:
        return float(value)
    except (ValueError, TypeError):
        return default


def optional_float(value: Any) -> Optional[float]:
    """Return a float when present and valid; otherwise None (for alert logic)."""
    if value is None:
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None
