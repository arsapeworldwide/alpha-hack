from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

from app.domain.types import CreditHistory, Segment

Inn = Annotated[str, Field(strict=True, pattern=r"^(?:[0-9]{10}|[0-9]{12})$")]


class CompanyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    inn: Inn
    name: str
    annual_revenue: int
    monthly_payments: int
    credit_history: CreditHistory
    business_age_years: int
    segment: Segment
    synthetic: bool = True


class CompanyLookupResponse(BaseModel):
    found: bool
    company: CompanyResponse | None
    message: str
