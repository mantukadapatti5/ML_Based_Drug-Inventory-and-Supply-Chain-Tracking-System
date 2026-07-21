import pandas as pd
import numpy as np
import os

class ROPOptimizer:
    def __init__(self, csv_path: str = "data/module5_drug_consumption_history.csv"):
        alt_paths = [
            csv_path,
            os.path.join("..", csv_path),
            os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), csv_path)
        ]
        
        found_path = None
        for p in alt_paths:
            if os.path.exists(p):
                found_path = p
                break
                
        if not found_path:
            # Create empty DF if not found, let it fail gracefully on get_demand_stats
            self.df = pd.DataFrame()
        else:
            self.df = pd.read_csv(found_path, parse_dates=["Date"])
    
    def get_demand_stats(self, drug_id: str, region: str, days: int = 90) -> dict:
        if self.df.empty:
            raise ValueError("Consumption history data not available.")
            
        # Sort to get latest data
        sorted_df = self.df.sort_values('Date', ascending=False)
        
        # Filter for drug + region
        mask = (sorted_df['Drug_ID'] == drug_id) & (sorted_df['Region'] == region)
        filtered_df = sorted_df[mask]
        
        if filtered_df.empty:
            return {
                "avg_demand": 0.0,
                "std_demand": 0.0,
                "data_coverage_pct": 0.0,
                "row_count": 0
            }
            
        # Get last `days` days 
        latest_date = filtered_df['Date'].iloc[0]
        cutoff_date = latest_date - pd.Timedelta(days=days)
        
        recent_df = filtered_df[filtered_df['Date'] > cutoff_date]
        row_count = len(recent_df)
        
        if row_count == 0:
            return {
                "avg_demand": 0.0,
                "std_demand": 0.0,
                "data_coverage_pct": 0.0,
                "row_count": 0
            }
            
        avg_demand = recent_df['Daily_Consumption_Units'].mean()
        std_demand = recent_df['Daily_Consumption_Units'].std()
        
        if pd.isna(std_demand):
            std_demand = 0.0
            
        data_coverage_pct = (row_count / days) * 100
        
        return {
            "avg_demand": float(avg_demand),
            "std_demand": float(std_demand),
            "data_coverage_pct": float(data_coverage_pct),
            "row_count": row_count
        }
    
    def calculate_rop(self, drug_id: str, region: str, supplier_id: str,
                      supplier_data: dict, unit_price: float) -> dict:
        
        stats = self.get_demand_stats(drug_id, region, 90)
        
        avg_demand = stats["avg_demand"]
        std_demand = stats["std_demand"]
        data_coverage_pct = stats["data_coverage_pct"]
        
        avg_lead_time = supplier_data.get("average_lead_time_days", 10.0)
        min_lead_time = supplier_data.get("min_lead_time", 7.0)
        max_lead_time = supplier_data.get("max_lead_time", 14.0)
        delivery_accuracy = supplier_data.get("delivery_accuracy_rate_pct", 95.0)
        
        lead_time_variability = (max_lead_time - min_lead_time) / 4
        
        # Safety stock calculation
        variance_term = (avg_lead_time * (std_demand ** 2)) + ((avg_demand ** 2) * (lead_time_variability ** 2))
        safety_stock = 1.65 * np.sqrt(variance_term)
        
        # ROP calculation
        rop = (avg_demand * avg_lead_time) + safety_stock
        
        # EOQ calculation
        annual_demand = avg_demand * 365
        ordering_cost = 500.0
        holding_cost = 0.20 * unit_price
        
        economic_order_qty = 0
        if holding_cost > 0:
            economic_order_qty = np.sqrt((2 * annual_demand * ordering_cost) / holding_cost)
            
        confidence_score = (delivery_accuracy / 100.0) * (min(100.0, data_coverage_pct) / 100.0)
        
        from datetime import datetime
        
        return {
            "drug_id": drug_id,
            "region": region,
            "supplier_id": supplier_id,
            "avg_daily_demand": round(avg_demand, 2),
            "std_daily_demand": round(std_demand, 2),
            "avg_lead_time_days": round(avg_lead_time, 2),
            "safety_stock": round(safety_stock, 2),
            "rop": round(rop, 2),
            "economic_order_qty": int(np.ceil(economic_order_qty)),
            "confidence_score": round(confidence_score, 2),
            "data_coverage_pct": round(data_coverage_pct, 2),
            "calculated_at": datetime.utcnow().isoformat() + "Z",
            "formula_breakdown": {
                "lead_time_variability": round(lead_time_variability, 2),
                "z_score_used": 1.65,
                "ordering_cost_inr": ordering_cost,
                "holding_cost_pct": 0.20
            }
        }
    
    def calculate_bulk(self, drug_ids: list, region: str,
                       supplier_map: dict, price_map: dict) -> list:
        results = []
        for drug_id in drug_ids:
            if drug_id in supplier_map and drug_id in price_map:
                res = self.calculate_rop(
                    drug_id, 
                    region, 
                    supplier_map[drug_id].get("supplier_id"),
                    supplier_map[drug_id],
                    price_map[drug_id]
                )
                results.append(res)
        return results
