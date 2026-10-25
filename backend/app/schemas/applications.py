from datetime import UTC, date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.domain.state_machine import Actor, Status
from app.domain.types import Goal
from app.schemas.companies import CompanyResponse


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
    company: CompanyResponse


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
    code: Literal["egrul", "bki", "scoring"]
    title: str
    state: Literal["pending", "in_progress", "done", "failed"]
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
    code: Literal["credit_history", "debt_load", "revenue", "business_age", "amount_to_revenue"]
    name: str
    points: float
    max_points: int
    explanation: str


class DecisionResponse(BaseModel):
    outcome: Literal["APPROVED", "COUNTER_OFFER", "REJECTED"]
    score: int | None
    factors: list[FactorResponse]
    rate: float | None
    approved_amount: int | None
    term_months: int
    monthly_payment: int | None
    overpayment: int | None
    total_payment: int | None
    max_amount: int | None
    capacity: int
    debt_ratio: float
    rejection_reason: str | None
    recommendations: list[str]
    reapply_date: date | None
    decided_by: Literal["system", "bank"]
    bank_comment: str | None


class ApplicationResponse(UtcModel):
    id: str
    status: Status
    status_label: str
    error_message: str | None
    created_at: datetime
    updated_at: datetime
    company: CompanyResponse
    requested_amount: int
    term_months: int
    goal: Goal
    goal_label: str
    pipeline: list[PipelineStage]
    decision: DecisionResponse | None
    sign_attempts_left: int
    signed_at: datetime | None
    disbursed_at: datetime | None
    events: list[EventResponse]


class ApplicationSummary(UtcModel):
    id: str
    status: Status
    status_label: str
    created_at: datetime
    company_name: str
    requested_amount: int
    approved_amount: int | None
    goal: Goal
