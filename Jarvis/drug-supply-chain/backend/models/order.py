from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, func
from ..models.base import Base


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    distributor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    drug_id = Column(Integer, ForeignKey("drugs.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    status = Column(String(80), nullable=False, default="Placed")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
