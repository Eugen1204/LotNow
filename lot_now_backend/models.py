from typing import Optional

from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, ForeignKey, Numeric, DateTime, Text
from sqlalchemy import Enum as SQLEnum
from datetime import datetime
from enum import Enum
from uuid import uuid4
from decimal import Decimal


class Base(DeclarativeBase):
    pass


class LotStatus(str, Enum):
    DRAFT = "draft"  # Черновик
    ACTIVE = "active"  # Активные торги
    SOLD = "sold"  # Продан
    UNSOLD = "unsold"  # не продан
    CANCELLED = "cancelled"  # отменен


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(30), unique=True, nullable=False, index=True)
    bio: Mapped[str] = mapped_column(String(500), nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    leading_lots = relationship("Lot",
                                foreign_keys="[Lot.current_leader_id]",
                                back_populates="current_leader")
    created_lots = relationship(
        "Lot",
        foreign_keys="[Lot.creator_id]",
        back_populates="creator"
    )
    bids = relationship("Bid", back_populates="user", cascade="all, delete-orphan")


class Lot(Base):
    __tablename__ = "lots"

    id: Mapped[int] = mapped_column(primary_key=True)
    creator_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    start_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    min_step: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    current_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    current_leader_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[LotStatus] = mapped_column(SQLEnum(LotStatus), default=LotStatus.ACTIVE, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    image_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    creator = relationship("User", foreign_keys=[creator_id], back_populates="created_lots")
    current_leader = relationship("User", foreign_keys=[current_leader_id], back_populates="leading_lots")

    @property
    def current_leader_username(self) -> Optional[str]:
        return self.current_leader.username if self.current_leader else None

    bids = relationship("Bid", back_populates="lot", cascade="all, delete-orphan")


class Bid(Base):
    __tablename__ = "bids"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    lot_id: Mapped[int] = mapped_column(ForeignKey("lots.id"), nullable=False, index=True)
    bid_uuid: Mapped[str] = mapped_column(String(36), unique=True, nullable=False, default=lambda: str(uuid4()))
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow,
                                                 onupdate=datetime.utcnow)

    user = relationship("User", back_populates="bids")
    lot = relationship("Lot", back_populates="bids")
