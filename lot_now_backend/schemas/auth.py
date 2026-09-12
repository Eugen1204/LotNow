from pydantic import BaseModel, EmailStr, field_validator, Field
from datetime import datetime
from typing import Optional
from pydantic.networks import email_validator



class UserCreate(BaseModel):
    username: str = Field(min_length=5, max_length=30)
    email: EmailStr
    password: str = Field(min_length=6, max_length=30)

    @field_validator('username')
    @classmethod
    def username_is_alphanum(cls, v: str) -> str:
        if not v.isalnum():
            raise ValueError('Username must contain only letters and numbers')
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: EmailStr
    created_at: datetime
    avatar_url: Optional[str]
    bio: Optional[str]

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=5, max_length=30)
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=6, max_length=30)

class TokenResponse(BaseModel):
    access_token: str
    token_type: str="bearer"

class UserPage(BaseModel):
    id: int
    username: str
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    class Config:
        from_attributes = True

class UserProfileUpdate(BaseModel):
    bio: Optional[str] = None
    avatar_url: Optional[str] = None