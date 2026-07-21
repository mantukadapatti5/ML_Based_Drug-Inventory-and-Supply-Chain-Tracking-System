#!/usr/bin/env python3
"""Train ML models for demand forecasting and anomaly detection.

Run from project root:
  python scripts/train_models.py
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ML_DIR = os.path.join(ROOT, "backend", "ml")
sys.path.insert(0, ML_DIR)
os.chdir(ROOT)

from train_all_models import train_everything  # noqa: E402

if __name__ == "__main__":
    train_everything()
