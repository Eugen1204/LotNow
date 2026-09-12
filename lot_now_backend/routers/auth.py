from fastapi import APIRouter, Depends, HTTPException
from schemas.auth import UserCreate, UserResponse, UserLogin, TokenResponse
from utils.security import hash_password, verify_password, create_access_token
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_session
from models import User
from sqlalchemy import select

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse)
async def register(data: UserCreate, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(User).where(User.email == data.email))
    if result.one_or_none():
        raise HTTPException(status_code=400, detail="Email уже занят")
    else:
        new_user = User(username=data.username,
                        email=data.email,
                        password_hash=hash_password(data.password))
        session.add(new_user)
        await session.commit()
        await session.refresh(new_user)
        return new_user



@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(User)
                                   .where(User.email == data.email))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=401, detail="Неверный email или пароль")

    if not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Неверный email или пароль")

    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token)
