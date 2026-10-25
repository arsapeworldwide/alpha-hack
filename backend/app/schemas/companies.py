from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.domain.types import CreditHistory

Inn = Annotated[str, Field(strict=True, pattern=r"^(?:[0-9]{10}|[0-9]{12})$")]


class CompanyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    inn: Inn
    name: Annotated[str, Field(strict=True, min_length=1, max_length=200)]
    annual_revenue: Annotated[int, Field(strict=True, ge=1)]
    monthly_payments: Annotated[int, Field(strict=True, ge=0)]
    credit_history: CreditHistory
    business_age_years: Annotated[int, Field(strict=True, ge=0, le=100)]
    segment: Literal["retail", "services", "production"]


class RegistryCompanyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="ignore")
    inn: Inn
    name: Annotated[str, Field(strict=True, min_length=1, max_length=200)]
    annual_revenue: Annotated[int, Field(strict=True, ge=1)]
    business_age_years: Annotated[int, Field(strict=True, ge=0, le=100)]
    segment: Literal["retail", "services", "production"]


class DemoProfileResponse(BaseModel):
    id: str
    label: str
    risk_level: Literal["ideal", "medium", "risky"]
    company: RegistryCompanyResponse
