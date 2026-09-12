from pydantic import BaseModel, EmailStr, field_validator, Field
from decimal import Decimal
from datetime import datetime


class BidResponse(BaseModel):
    id: int
    lot_id: int
    amount: Decimal
    created_at: datetime

    class Config:
        from_attributes = True
