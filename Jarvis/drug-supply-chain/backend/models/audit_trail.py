from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, func
from ..models.base import Base


class AuditTrail(Base):
    __tablename__ = "audit_trail"

    id = Column(Integer, primary_key=True, index=True)
    action = Column(String(180), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    entity = Column(String(120), nullable=False)
    entity_id = Column(Integer, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    blockchain_hash = Column(String(128), nullable=True)
    batch_id = Column(String(255), nullable=True, index=True)  # Feature #7: Batch tracking for related operations
