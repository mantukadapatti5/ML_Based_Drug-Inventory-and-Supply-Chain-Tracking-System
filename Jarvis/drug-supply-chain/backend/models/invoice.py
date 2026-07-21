from sqlalchemy import Column, Integer, ForeignKey, Float, String, DateTime, func
from ..models.base import Base


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    amount = Column(Float, nullable=False)
    status = Column(String(80), nullable=False, default="Pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
