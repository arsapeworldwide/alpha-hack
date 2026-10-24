from datetime import UTC, date, datetime
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import (
    JSON,
    BigInteger,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from app.domain.state_machine import Actor, Status
from app.domain.types import CreditHistory, Goal, Segment


def utc_now() -> datetime:
    return datetime.now(UTC)


def enum_column(enum_class: type, name: str) -> Enum:
    return Enum(
        enum_class,
        values_callable=lambda values: [v.value for v in values],
        native_enum=False,
        create_constraint=True,
        name=name,
    )


class Base(DeclarativeBase):
    pass


class Company(Base):
    __tablename__ = "companies"
    __table_args__ = (
        CheckConstraint("annual_revenue > 0"),
        CheckConstraint("monthly_payments >= 0"),
        CheckConstraint("business_age_years >= 0"),
    )

    inn: Mapped[str] = mapped_column(String(12), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    annual_revenue: Mapped[int] = mapped_column(BigInteger)
    monthly_payments: Mapped[int] = mapped_column(BigInteger)
    credit_history: Mapped[CreditHistory] = mapped_column(enum_column(CreditHistory, "history"))
    business_age_years: Mapped[int]
    segment: Mapped[Segment] = mapped_column(enum_column(Segment, "company_segment"))
    synthetic: Mapped[bool] = mapped_column(default=True)


class Application(Base):
    __tablename__ = "applications"
    __table_args__ = (
        CheckConstraint("requested_amount BETWEEN 300000 AND 15000000"),
        CheckConstraint("term_months BETWEEN 3 AND 36"),
        CheckConstraint("goal != 'cash_gap' OR term_months <= 12"),
        CheckConstraint("sign_attempts BETWEEN 0 AND 5"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    company_inn: Mapped[str] = mapped_column(ForeignKey("companies.inn"))
    company_snapshot: Mapped[dict] = mapped_column(JSON, default=dict)
    requested_amount: Mapped[int] = mapped_column(BigInteger)
    term_months: Mapped[int]
    goal: Mapped[Goal] = mapped_column(enum_column(Goal, "goal"))
    status: Mapped[Status] = mapped_column(
        enum_column(Status, "status"), default=Status.DRAFT, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )
    idempotency_key: Mapped[str | None] = mapped_column(String(200), unique=True)
    request_fingerprint: Mapped[str | None] = mapped_column(String(64))
    score: Mapped[int | None]
    rate: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    offered_amount: Mapped[int | None] = mapped_column(BigInteger)
    monthly_payment: Mapped[int | None] = mapped_column(BigInteger)
    overpayment: Mapped[int | None] = mapped_column(BigInteger)
    rejection_reason: Mapped[str | None] = mapped_column(Text)
    recommendations: Mapped[list] = mapped_column(JSON, default=list)
    reapply_date: Mapped[date | None]
    sign_attempts: Mapped[int] = mapped_column(default=0)
    manual_decision: Mapped[bool] = mapped_column(default=False)
    version: Mapped[int] = mapped_column(default=1)
    __mapper_args__ = {"version_id_col": version}

    company: Mapped[Company] = relationship()
    events: Mapped[list["ApplicationEvent"]] = relationship(
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="ApplicationEvent.id",
    )
    factors: Mapped[list["ScoringFactor"]] = relationship(
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="ScoringFactor.id",
    )


class ApplicationEvent(Base):
    __tablename__ = "application_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[str] = mapped_column(
        ForeignKey("applications.id", ondelete="CASCADE"),
        index=True,
    )
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    from_status: Mapped[Status | None] = mapped_column(enum_column(Status, "event_from_status"))
    to_status: Mapped[Status] = mapped_column(enum_column(Status, "event_to_status"))
    actor: Mapped[Actor] = mapped_column(enum_column(Actor, "event_actor"))
    details: Mapped[dict] = mapped_column(JSON, default=dict)


class ScoringFactor(Base):
    __tablename__ = "factors"
    __table_args__ = (UniqueConstraint("application_id", "code"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[str] = mapped_column(
        ForeignKey("applications.id", ondelete="CASCADE"),
        index=True,
    )
    code: Mapped[str] = mapped_column(String(40))
    name: Mapped[str] = mapped_column(String(100))
    points: Mapped[Decimal] = mapped_column(Numeric(24, 16))
    maximum: Mapped[int]
    explanation: Mapped[str] = mapped_column(Text)


class FeedArticle(Base):
    __tablename__ = "feed_articles"

    id: Mapped[str] = mapped_column(String(60), primary_key=True)
    segment: Mapped[Segment] = mapped_column(enum_column(Segment, "feed_segment"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    summary: Mapped[str] = mapped_column(Text)
    full_text: Mapped[str] = mapped_column(Text)
    tag: Mapped[str] = mapped_column(String(60))
    reading_minutes: Mapped[int]
    rejection_priority: Mapped[int] = mapped_column(default=10)
    synthetic: Mapped[bool] = mapped_column(default=True)
