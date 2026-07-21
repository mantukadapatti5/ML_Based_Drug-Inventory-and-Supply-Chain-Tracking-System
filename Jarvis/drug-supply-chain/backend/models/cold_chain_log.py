from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, func
from ..models.base import Base

class ColdChainLog(Base):
    __tablename__ = "cold_chain_logs"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("drugs.id"), nullable=False)
    device_id = Column(String(100), nullable=False)
    temperature_c = Column(Float, nullable=False)
    humidity_pct = Column(Float, nullable=False)
    
    # NEW: Weight Sensing Features for liquid drug monitoring
    current_weight_g = Column(Float, default=0.0)
    tare_weight_g = Column(Float, default=0.0)
    
    # Liquid volume estimation (assuming 1g ~ 1ml for water-based drugs)
    # Calculated in service layer or via hybrid property
    
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    location = Column(String(200))
    status = Column(String(50), default="Normal") # Normal, Warning, Critical
