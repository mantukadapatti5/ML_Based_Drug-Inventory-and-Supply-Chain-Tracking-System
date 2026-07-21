from datetime import date, datetime
from pydantic import BaseModel, EmailStr, Field
from typing import Optional


class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: str
    license_no: Optional[str]
    verified: bool = False


class UserCreate(UserBase):
    password: str = Field(..., min_length=8)


class UserRead(UserBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True


class DrugBase(BaseModel):
    name: str
    batch_no: str
    manufacturer: str
    expiry_date: date
    quantity: int
    price: float
    vendor_id: int


class DrugRead(DrugBase):
    id: int

    class Config:
        orm_mode = True


class InventoryBase(BaseModel):
    drug_id: int
    quantity: int
    location: str
    rfid_tag: str


class InventoryRead(InventoryBase):
    id: int
    last_updated: datetime

    class Config:
        orm_mode = True


class OrderBase(BaseModel):
    vendor_id: int
    distributor_id: int
    drug_id: int
    quantity: int


class OrderRead(OrderBase):
    id: int
    status: str
    created_at: datetime

    class Config:
        orm_mode = True


class InvoiceBase(BaseModel):
    order_id: int
    amount: float
    status: str


class InvoiceRead(InvoiceBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True


class SaleBase(BaseModel):
    distributor_id: int
    drug_id: int
    quantity: int
    amount: float


class SaleRead(SaleBase):
    id: int
    sale_date: datetime

    class Config:
        orm_mode = True


class ColdChainLogBase(BaseModel):
    drug_id: int
    temperature: float
    humidity: float
    alert_triggered: bool = False


class ColdChainLogRead(ColdChainLogBase):
    id: int
    timestamp: datetime

    class Config:
        orm_mode = True


class AnomalyLogBase(BaseModel):
    drug_id: int
    anomaly_type: str
    confidence_score: float
    status: str


class AnomalyLogRead(AnomalyLogBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True


class SupplierRatingBase(BaseModel):
    vendor_id: int
    distributor_id: int
    score: float
    feedback: Optional[str] = None


class SupplierRatingRead(SupplierRatingBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True


class AuditTrailBase(BaseModel):
    action: str
    user_id: int
    entity: str
    entity_id: int
    blockchain_hash: Optional[str] = None


class AuditTrailRead(AuditTrailBase):
    id: int
    timestamp: datetime

    class Config:
        orm_mode = True
