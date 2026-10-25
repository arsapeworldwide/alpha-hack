from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, SecretStr


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    login: str = Field(min_length=1, max_length=60, pattern=r"^[a-z0-9-]+$")
    password: SecretStr = Field(min_length=1, max_length=200)


class UserResponse(BaseModel):
    login: str
    full_name: str
    role: Literal["client_owner", "client_accountant", "underwriter"]
    company_inns: list[str]
    can_manage_demo: bool


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse


class DemoAccount(BaseModel):
    login: str
    full_name: str
    role: str
    scenario: str


class FailureSettings(BaseModel):
    model_config = ConfigDict(extra="forbid")
    bki: Literal["ok", "down"]
