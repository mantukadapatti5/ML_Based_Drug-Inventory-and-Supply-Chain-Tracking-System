from sqlalchemy import Column, Integer, ForeignKey, Float, DateTime, func
from ..models.base import Base


class Sale(Base):
    __tablename__ = "sales"

    id = Column(Integer, primary_key=True, index=True)
    distributor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    drug_id = Column(Integer, ForeignKey("drugs.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    sale_date = Column(DateTime(timezone=True), server_default=func.now())
    amount = Column(Float, nullable=False)
