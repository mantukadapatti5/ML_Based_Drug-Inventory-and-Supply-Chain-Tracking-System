import os
import sys
import numpy as np
import pandas as pd

# Add current dir to path for imports
sys.path.append(os.path.dirname(__file__))
from anomaly_detector import AnomalyDetector

def train_anomaly_models():
    print("Starting Anomaly Detection model training...")
    
    # Locate dataset
    csv_path = "data/module13_anomaly_detection_features.csv"
    alt_paths = [
        "../data/module13_anomaly_detection_features.csv",
        "../../data/module13_anomaly_detection_features.csv",
        "../../../data/module13_anomaly_detection_features.csv"
    ]
    
    found_path = None
    if os.path.exists(csv_path):
        found_path = csv_path
    else:
        for p in alt_paths:
            if os.path.exists(p):
                found_path = p
                break
                
    if not found_path:
        print(f"Error: Could not find module13_anomaly_detection_features.csv in {os.getcwd()}")
        return
        
    print(f"Loading data from {found_path}...")
    detector = AnomalyDetector()
    X_scaled = detector.load_and_preprocess(found_path)
    
    print("Training Isolation Forest...")
    detector.train_isolation_forest(X_scaled)
    
    print("Training Autoencoder (Ensemble)...")
    # Reduced epochs for quicker SIH demo training
    detector.train_autoencoder(X_scaled, epochs=5, batch_size=32)
    
    print("Anomaly Detection models trained and saved to saved_models/ and scalers/")

if __name__ == "__main__":
    try:
        train_anomaly_models()
    except Exception as e:
        import traceback
        print(f"CRITICAL ERROR: {e}")
        traceback.print_exc()
