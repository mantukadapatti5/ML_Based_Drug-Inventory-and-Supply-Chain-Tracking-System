from sqlalchemy import Column, Integer, String, Numeric, DateTime, func, Index
from ..models.base import Base


class ShipmentCoordinates(Base):
    __tablename__ = "shipment_coordinates"

    id = Column(Integer, primary_key=True, index=True)
    shipment_id = Column(String(255), nullable=False, index=True)
    latitude = Column(Numeric(10, 8), nullable=False)
    longitude = Column(Numeric(11, 8), nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    # Optional: Additional tracking metadata for Feature #18 (GPS Tracking)
    speed_kmh = Column(Numeric(5, 2), nullable=True)
    battery_pct = Column(Integer, nullable=True)
    signal_strength_dbm = Column(Integer, nullable=True)
    transit_status = Column(String(120), nullable=True, default="In Transit")
    
    __table_args__ = (
        Index('idx_shipment_timestamp', 'shipment_id', 'timestamp'),
    )
