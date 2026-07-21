from sqlalchemy import Column, Integer, ForeignKey, String, Float, DateTime, Boolean, func
from ..models.base import Base


class AnomalyLog(Base):
    __tablename__ = "anomaly_logs"

    id = Column(Integer, primary_key=True, index=True)
    drug_id = Column(Integer, ForeignKey("drugs.id"), nullable=False)
    anomaly_type = Column(String(120), nullable=False)
    confidence_score = Column(Float, nullable=False)
    status = Column(String(80), nullable=False, default="Open")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    # Feature #13: Anomaly resolution metrics
    resolved = Column(Boolean, default=False, nullable=False)
    resolved_by = Column(String(255), nullable=True)
    resolution_notes = Column(String(1024), nullable=True)
