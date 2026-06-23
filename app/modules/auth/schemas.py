from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserBase(BaseModel):
    email: EmailStr = Field(..., description="Unique email address of the user.")


class UserCreate(UserBase):
    password: str = Field(
        ..., min_length=8, description="Plain text password (min 8 chars)."
    )


class UserOut(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool = True
    first_name: str | None = None
    last_name: str | None = None
    role: str = "user"
    is_deleted: bool = False


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    refresh_token: str = Field(
        ..., description="Secure refresh token for token rotation."
    )


class TokenPayload(BaseModel):
    sub: str | None = None
    exp: int | None = None


class TokenRefreshRequest(BaseModel):
    refresh_token: str = Field(
        ...,
        description="Valid refresh token to obtain a new access/refresh token pair.",
    )


class LogoutRequest(BaseModel):
    refresh_token: str = Field(
        ..., description="The refresh token to revoke upon logout."
    )
