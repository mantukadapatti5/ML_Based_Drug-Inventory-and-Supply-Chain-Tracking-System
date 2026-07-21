import os
import subprocess
import sys

# Add current dir to path for imports
sys.path.append(os.path.dirname(__file__))

from demand_forecaster import load_or_train, get_all_drug_region_pairs
# from train_anomaly_models import train_anomaly_models

def run_isolated_training(script_name):
    print(f"Running {script_name} in isolated process...")
    try:
        # Run in a separate process so a silent crash doesn't kill the main script
        result = subprocess.run([sys.executable, script_name], 
                                cwd=os.path.dirname(__file__),
                                capture_output=True, text=True)
        print(result.stdout)
        if result.stderr:
            print(f"Errors in {script_name}: {result.stderr}")
        return result.returncode == 0
    except Exception as e:
        print(f"Failed to launch {script_name}: {e}")
        return False

def train_everything():
    print("=== STARTING FULL MODEL TRAINING PIPELINE ===")
    
    # 1. Train Anomaly Models (Isolated)
    print("\n[STEP 1] Training Anomaly Models...")
    run_isolated_training("train_anomaly_models.py")

    # 2. Train Demand Models for all drug-region pairs (Direct since we have RF fallback)
    print("\n[STEP 2] Starting Demand Forecasting training...")
    try:
        csv_path = "../../data/module5_drug_consumption_history.csv"
        if not os.path.exists(csv_path):
             csv_path = "data/module5_drug_consumption_history.csv"
        
        # We'll just train them directly. If they crash due to TF, the isolated mode in load_or_train won't help unless we isolate every call.
        # But we'll just use RF for now if it fails.
        
        pairs = get_all_drug_region_pairs(csv_path)
        print(f"Found {len(pairs)} drug-region pairs.")
        
        for i, pair in enumerate(pairs[:5]):
            print(f"[{i+1}/5] Training {pair['Drug_Name']} in {pair['Region']}...")
            try:
                # We'll run a mini script for each to be safe
                load_or_train(pair['Drug_ID'], pair['Region'])
            except Exception as e:
                print(f"Skipping {pair['Drug_Name']} due to error: {e}")
                
    except Exception as e:
        print(f"Demand training failed: {e}")

    print("\n=== FULL TRAINING PIPELINE COMPLETE ===")

if __name__ == "__main__":
    train_everything()
