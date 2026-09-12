from fastapi import APIRouter, Depends, HTTPException
from schemas.lots import LotResponse, LotCreate, LotUpdate
from utils.security import get_current_user, \
    get_current_user_optional
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_session
from models import Lot, User, LotStatus
from sqlalchemy import select, or_
from typing import List, Optional
from sqlalchemy.orm import selectinload

router = APIRouter(prefix="/lots", tags=["lots"])


@router.get("/", response_model=List[LotResponse])
async def get_lots(session: AsyncSession = Depends(get_session),
                   current_user: Optional[User] = Depends(get_current_user_optional),
                   status_filter: Optional[LotStatus] = None
                   ):
    query = select(Lot).options(selectinload(Lot.current_leader))
    if status_filter:
        query = query.where(Lot.status == status_filter)
        if status_filter == LotStatus.DRAFT:
            if current_user:
                query = query.where(Lot.creator_id == current_user.id)
            else:
                return []

    else:
        if current_user:
            query = query.where(or_(Lot.status != LotStatus.DRAFT, Lot.creator_id == current_user.id))
        else:
            query = query.where(Lot.status != LotStatus.DRAFT)

    result = await session.execute(query)
    return result.scalars().all()


@router.get("/{lot_id}", response_model=LotResponse)
async def get_lot(lot_id: int, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(Lot).options(selectinload(Lot.current_leader))
                                   .where(Lot.id == lot_id))
    lot = result.scalar_one_or_none()
    if not lot:
        raise HTTPException(status_code=404, detail="Лот не найден")
    return lot


@router.post("/", response_model=LotResponse)
async def create_lot(data: LotCreate,
                     session: AsyncSession = Depends(get_session),
                     current_user: User = Depends(get_current_user)):
    new_lot = Lot(
        creator_id=current_user.id,
        title=data.title,
        description=data.description,
        status=LotStatus.DRAFT,
        start_price=data.start_price,
        min_step=data.min_step,
        current_price=data.start_price,
        start_time=data.start_time,
        end_time=data.end_time,
        image_url=data.image_url
    )
    session.add(new_lot)
    await session.commit()
    await session.refresh(new_lot)
    return new_lot


@router.patch("/{lot_id}/publish", response_model=LotResponse)
async def publish_lot(
        lot_id: int,
        current_user: User = Depends(get_current_user),
        session: AsyncSession = Depends(get_session)
):
    result = await session.execute(select(Lot).
                                   options(selectinload(Lot.current_leader)).
                                   where(Lot.id == lot_id))
    lot = result.scalar_one_or_none()
    if not lot:
        raise HTTPException(status_code=404, detail="Лот не найден")
    if lot.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Вы не автор этого лота")
    if lot.status != LotStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Лот уже опубликован")
    if not lot.start_time or not lot.end_time:
        raise HTTPException(
            status_code=400,
            detail="Нельзя опубликовать лот без указания дат торгов"
        )
    lot.status = LotStatus.ACTIVE

    await session.commit()
    await session.refresh(lot, ["current_leader"])

    return lot


@router.patch("/{lot_id}", response_model=LotResponse)
async def update_lot(
        lot_id: int,
        data: LotUpdate,
        current_user: User = Depends(get_current_user),
        session: AsyncSession = Depends(get_session)
):
    result = await session.execute(
        select(Lot)
        .options(selectinload(Lot.current_leader))
        .where(Lot.id == lot_id)
    )
    lot = result.scalar_one_or_none()

    if not lot:
        raise HTTPException(status_code=404, detail="Лот не найден")
    if lot.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Вы не автор этого лота")
    if lot.status != LotStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Редактировать можно только черновик")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(lot, field, value)

    await session.commit()
    await session.refresh(lot, ["current_leader"])

    return lot
