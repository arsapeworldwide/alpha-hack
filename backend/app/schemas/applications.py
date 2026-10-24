from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.domain.state_machine import Actor, Status
from app.domain.types import Goal
from app.schemas.companies import CompanyResponse, Inn


class LoanParameters(BaseModel):
    model_config = ConfigDict(extra="forbid")

    requested_amount: Annotated[int, Field(strict=True, ge=300_000, le=15_000_000)]
    term_months: Annotated[int, Field(strict=True, ge=3, le=36)]
    goal: Goal

    @model_validator(mode="after")
    def validate_cash_gap(self):
        if self.goal == Goal.CASH_GAP and self.term_months > 12:
            raise ValueError("Для кассового разрыва срок не более 12 месяцев")
        return self


class CreateApplication(LoanParameters):
    inn: Inn


class SignRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: Annotated[str, Field(strict=True, pattern=r"^[0-9]{4}$")]


class UtcModel(BaseModel):
    @field_validator("*", mode="after")
    @classmethod
    def attach_utc(cls, value):
        # SQLite возвращает naive datetime, хотя в БД записывается время UTC.
        if isinstance(value, datetime) and value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value


class PipelineStage(UtcModel):
    code: Status
    name: str
    state: Literal["pending", "active", "completed", "failed"]
    started_at: datetime | None = None
    finished_at: datetime | None = None


class EventResponse(UtcModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    occurred_at: datetime
    from_status: Status | None
    to_status: Status
    actor: Actor
    details: dict


class FactorResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    code: str
    name: str
    points: Decimal
    maximum: int
    explanation: str


class DecisionResponse(BaseModel):
    status: Status
    annual_rate: Decimal | None
    amount: int | None
    monthly_payment: int | None
    overpayment: int | None
    manual: bool


class ApplicationResponse(UtcModel):
    id: str
    status: Status
    status_label: str
    message: str | None
    created_at: datetime
    updated_at: datetime
    company: CompanyResponse
    parameters: LoanParameters
    stages: list[PipelineStage]
    decision: DecisionResponse | None
    score: int | None
    factors: list[FactorResponse]
    rejection_reason: str | None
    recommendations: list[str]
    reapply_date: date | None
    sign_attempts_remaining: int
    events: list[EventResponse]
