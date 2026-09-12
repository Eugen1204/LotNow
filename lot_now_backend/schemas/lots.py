from pydantic import BaseModel, Field, model_validator
from datetime import datetime
from decimal import Decimal
from models import LotStatus
from typing import Optional


class LotCreate(BaseModel):
    title: str = Field(min_length=5, max_length=255)
    description: str = Field(max_length=500)
    start_price: Decimal
    min_step: Decimal
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    image_url: Optional[str] = None
    status: LotStatus = LotStatus.DRAFT

    @model_validator(mode="after")
    def check_dates_for_active(self) -> "LotCreate":
        if self.status == LotStatus.ACTIVE:
            if not self.start_time or not self.end_time:
                raise ValueError("Для активного лота необходимо указать start_time и end_time")
            if self.end_time <= self.start_time:
                raise ValueError("end_time должен быть позже start_time")
        return self


class LotResponse(BaseModel):
    id: int
    creator_id: int
    title: str
    description: str
    start_price: Decimal
    min_step: Decimal
    current_price: Decimal
    current_leader_id: Optional[int] = None
    current_leader_username: Optional[str] = None
    start_time: datetime
    end_time: datetime
    status: LotStatus
    created_at: datetime
    image_url: Optional[str] = None

    class Config:
        from_attributes = True


class LotUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=5, max_length=255)
    description: Optional[str] = Field(None, max_length=500)
    start_price: Optional[Decimal] = None
    min_step: Optional[Decimal] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    image_url: Optional[str] = None



