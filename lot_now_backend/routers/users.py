from typing import List

from fastapi import APIRouter, Depends, HTTPException

from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import select
from models import Bid, User
from utils.security import get_current_user
from schemas.auth import UserResponse, UserPage, UserProfileUpdate
from schemas.users import BidResponse
from database import get_session


router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

users_bids_router = APIRouter(prefix="/users", tags=["users"])


@users_bids_router.get("/me/bids", response_model=List[BidResponse])
async def get_bids(current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(Bid).where(current_user.id == Bid.user_id))
    bids = result.scalars().all()
    return bids


@router.patch("/me", response_model=UserResponse)
async def update_profile(data: UserProfileUpdate, current_user: User = Depends(get_current_user),
                         session: AsyncSession = Depends(get_session)):
    if data.bio is not None:
        current_user.bio = data.bio
    if data.avatar_url is not None:
        current_user.avatar_url = data.avatar_url
    await session.commit()
    await session.refresh(current_user)
    return current_user


@router.get("/users/{user_id}", response_model=UserPage)
async def responce_userpage(user_id: int, session: AsyncSession = Depends(get_session)):
    res = await session.execute(select(User).where(User.id == user_id))
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="пользователь не найден")
    return user
