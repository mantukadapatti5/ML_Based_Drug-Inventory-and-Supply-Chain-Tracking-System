from sqlalchemy import Column, Integer, ForeignKey, Float, String, DateTime, func
from ..models.base import Base


class SupplierRating(Base):
    __tablename__ = "supplier_ratings"

    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    distributor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    score = Column(Float, nullable=False)
    feedback = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
