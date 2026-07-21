from sqlalchemy import Column, Integer, String, Date, Float, ForeignKey
from ..models.base import Base


class Drug(Base):
    __tablename__ = "drugs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(180), nullable=False)
    batch_no = Column(String(120), nullable=False, unique=True)
    manufacturer = Column(String(180), nullable=False)
    expiry_date = Column(Date, nullable=False)
    quantity = Column(Integer, nullable=False, default=0)
    price = Column(Float, nullable=False, default=0.0)
    vendor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
