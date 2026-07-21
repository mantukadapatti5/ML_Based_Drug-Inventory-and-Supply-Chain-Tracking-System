from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from ..models.base import Base


class Inventory(Base):
    __tablename__ = "inventory"

    id = Column(Integer, primary_key=True, index=True)
    drug_id = Column(Integer, ForeignKey("drugs.id"), nullable=False)
    quantity = Column(Integer, nullable=False, default=0)
    location = Column(String(180), nullable=False)
    last_updated = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    rfid_tag = Column(String(120), nullable=False, unique=True)
