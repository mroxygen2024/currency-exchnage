from typing import Optional
from pydantic import BaseModel, EmailStr, Field, model_validator


class UserProfileUpdate(BaseModel):
    """Schema for updating basic user profile information.

    Allows updating email, first name, and last name with validation.
    """

    email: Optional[EmailStr] = Field(None, description="New email address for the user.")
    first_name: Optional[str] = Field(None, max_length=100, description="User's first name.")
    last_name: Optional[str] = Field(None, max_length=100, description="User's last name.")


class UserPasswordChange(BaseModel):
    """Schema for changing the user's password.

    Ensures both current and new passwords meet length constraints and are different.
    """

    current_password: str = Field(..., min_length=8, description="The user's current password.")
    new_password: str = Field(..., min_length=8, description="The desired new password (min 8 characters).")

    @model_validator(mode="after")
    def validate_different_password(self) -> "UserPasswordChange":
        if self.current_password == self.new_password:
            raise ValueError("New password must be different from the current password.")
        return self
