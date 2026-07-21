from sqlalchemy import Column, Integer, String, Boolean, DateTime, func
from ..models.base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    email = Column(String(180), unique=True, index=True, nullable=False)
    password = Column(String(255), nullable=False)
    role = Column(String(32), nullable=False)
    license_no = Column(String(80), nullable=True)
    verified = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
