"""
CSV Fallback Data Pipeline Service
Provides production-safe dual-mode data serving: uses database when available, falls back to local CSV files.
"""

import os
import pandas as pd
import logging
from typing import List, Dict, Any, Optional
from pathlib import Path

logger = logging.getLogger(__name__)

# Absolute paths to CSV datasets
BASE_PATH = r"C:\Users\Mahanthesh V K\OneDrive\Desktop\Dummy"

CSV_PATHS = {
    "inventory": os.path.join(BASE_PATH, "module5_drug_consumption_history.csv"),
    "telemetry": os.path.join(BASE_PATH, "live_sensor_logs_fixed.csv"),
    "anomalies": os.path.join(BASE_PATH, "module13_anomaly_detection_features.csv"),
    "blockchain": os.path.join(BASE_PATH, "mod11_qr_code_registry_fixed.csv"),
}

# Cache loaded dataframes to avoid repeated disk I/O
_cache: Dict[str, pd.DataFrame] = {}


class CSVFallbackService:
    """Handles reading and serving CSV data with intelligent caching."""
    
    @staticmethod
    def load_csv(key: str, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Load CSV data by key. Caches result in memory.
        
        Args:
            key: One of 'inventory', 'telemetry', 'anomalies', 'blockchain'
            limit: Maximum rows to return
            
        Returns:
            List of dictionaries (JSON-serializable records)
            
        Raises:
            FileNotFoundError: If CSV file not found
            ValueError: If CSV parsing fails
        """
        
        # Check cache first
        if key in _cache:
            df = _cache[key]
            logger.debug(f"✅ Serving {key} from memory cache ({len(df)} rows)")
        else:
            # Load from disk
            path = CSV_PATHS.get(key)
            if not path:
                raise ValueError(f"Unknown CSV key: {key}. Available: {list(CSV_PATHS.keys())}")
            
            if not os.path.exists(path):
                raise FileNotFoundError(f"CSV file not found at {path}")
            
            try:
                df = pd.read_csv(path)
                _cache[key] = df
                logger.info(f"📂 Loaded {key} from disk: {len(df)} rows, {len(df.columns)} columns")
            except Exception as e:
                raise ValueError(f"Failed to parse CSV {path}: {str(e)}")
        
        # Convert to JSON-serializable format
        # Replace NaN with None, convert timestamps to strings
        df = df.head(limit).copy()
        df = df.where(pd.notnull(df), None)
        
        # Convert datetime columns to ISO strings
        for col in df.columns:
            if pd.api.types.is_datetime64_any_dtype(df[col]):
                df[col] = df[col].astype(str)
        
        records = df.to_dict(orient="records")
        logger.debug(f"✅ Returning {len(records)} records for {key}")
        return records
    
    @staticmethod
    def get_inventory_data(limit: int = 50) -> Dict[str, Any]:
        """Get inventory/consumption data for vendor panels."""
        try:
            data = CSVFallbackService.load_csv("inventory", limit)
            return {
                "status": "success",
                "source": "csv_fallback",
                "count": len(data),
                "data": data
            }
        except Exception as e:
            logger.error(f"❌ Inventory data error: {e}")
            return {
                "status": "error",
                "error": str(e),
                "count": 0,
                "data": []
            }
    
    @staticmethod
    def get_telemetry_data(limit: int = 50) -> Dict[str, Any]:
        """Get IoT sensor/cold chain telemetry data."""
        try:
            data = CSVFallbackService.load_csv("telemetry", limit)
            return {
                "status": "success",
                "source": "csv_fallback",
                "count": len(data),
                "data": data
            }
        except Exception as e:
            logger.error(f"❌ Telemetry data error: {e}")
            return {
                "status": "error",
                "error": str(e),
                "count": 0,
                "data": []
            }
    
    @staticmethod
    def get_anomalies_data(limit: int = 50) -> Dict[str, Any]:
        """Get ML anomaly detection results."""
        try:
            data = CSVFallbackService.load_csv("anomalies", limit)
            return {
                "status": "success",
                "source": "csv_fallback",
                "count": len(data),
                "data": data
            }
        except Exception as e:
            logger.error(f"❌ Anomalies data error: {e}")
            return {
                "status": "error",
                "error": str(e),
                "count": 0,
                "data": []
            }
    
    @staticmethod
    def get_blockchain_data(limit: int = 50) -> Dict[str, Any]:
        """Get blockchain registry/QR code verification data."""
        try:
            data = CSVFallbackService.load_csv("blockchain", limit)
            return {
                "status": "success",
                "source": "csv_fallback",
                "count": len(data),
                "data": data
            }
        except Exception as e:
            logger.error(f"❌ Blockchain data error: {e}")
            return {
                "status": "error",
                "error": str(e),
                "count": 0,
                "data": []
            }
    
    @staticmethod
    def clear_cache():
        """Clear memory cache (useful for testing)."""
        global _cache
        _cache.clear()
        logger.info("🗑️  CSV cache cleared")


# Singleton instance
csv_fallback_service = CSVFallbackService()
