from decimal import ROUND_HALF_UP, Decimal

from app.db.models import Application
from app.domain.annuity import maximum_amount, round_rubles
from app.domain.scoring import annual_rate, debt_ratio, payment_capacity
from app.domain.state_machine import STATUS_LABELS, Actor, Status
from app.domain.types import ScoringInput
from app.schemas.applications import (
    ApplicationResponse,
    ApplicationSummary,
    DecisionResponse,
    EventResponse,
    FactorResponse,
    PipelineStage,
)
from app.schemas.companies import CompanyResponse

PIPELINE_STAGES = (
    (Status.CHECKING_EGRUL, "egrul"),
    (Status.CHECKING_BKI, "bki"),
    (Status.SCORING, "scoring"),
)
DECISION_STATUSES = {Status.APPROVED, Status.COUNTER_OFFER, Status.REJECTED}
GOAL_LABELS = {
    "working_capital": "Пополнение оборотных средств",
    "equipment": "Покупка оборудования",
    "cash_gap": "Покрытие кассового разрыва",
}
FACTOR_CODES = {"history": "credit_history", "amount_share": "amount_to_revenue"}


def scoring_input(application: Application) -> ScoringInput:
    company = application.company_snapshot
    return ScoringInput(
        annual_revenue=company["annual_revenue"],
        monthly_payments=company["monthly_payments"],
        credit_history=company["credit_history"],
        business_age_years=company["business_age_years"],
        requested_amount=application.requested_amount,
        term_months=application.term_months,
        goal=application.goal,
    )


def decision_view(application: Application) -> DecisionResponse | None:
    outcome = next(
        (e.to_status for e in reversed(application.events) if e.to_status in DECISION_STATUSES),
        None,
    )
    if outcome is None:
        return None
    data = scoring_input(application)
    capacity = payment_capacity(data)
    rate = application.rate
    if rate is None and not application.manual_decision and (application.score or 0) >= 45:
        rate = annual_rate(application.score, application.goal)
    maximum = (
        maximum_amount(capacity, rate, application.term_months) if rate and capacity > 0 else None
    )
    comment = next(
        (e.details.get("comment") for e in reversed(application.events) if e.actor == Actor.BANK),
        None,
    )
    total = (
        application.offered_amount + application.overpayment
        if application.offered_amount is not None and application.overpayment is not None
        else None
    )
    return DecisionResponse(
        outcome=outcome,
        score=application.score,
        factors=[
            FactorResponse(
                code=FACTOR_CODES.get(f.code, f.code),
                name=f.name,
                points=float(Decimal(f.points).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)),
                max_points=f.maximum,
                explanation=f.explanation,
            )
            for f in application.factors
        ],
        rate=float(rate) if rate is not None else None,
        approved_amount=application.offered_amount,
        term_months=application.term_months,
        monthly_payment=application.monthly_payment,
        total_payment=total,
        overpayment=application.overpayment,
        max_amount=round_rubles(maximum) if maximum else None,
        capacity=round_rubles(capacity),
        debt_ratio=float(debt_ratio(data).quantize(Decimal("0.0001"))),
        rejection_reason=application.rejection_reason,
        recommendations=application.recommendations,
        reapply_date=application.reapply_date,
        decided_by="bank" if application.manual_decision else "system",
        bank_comment=comment,
    )


def application_view(application: Application) -> ApplicationResponse:
    def entered(status):
        return next((e.occurred_at for e in application.events if e.to_status == status), None)

    return ApplicationResponse(
        id=application.id,
        status=application.status,
        status_label=STATUS_LABELS[application.status],
        error_message=(
            "БКИ временно недоступно. Заявка сохранена; можно повторить проверку."
            if application.status == Status.NEEDS_RECHECK
            else None
        ),
        created_at=application.created_at,
        updated_at=application.updated_at,
        company=CompanyResponse.model_validate(application.company_snapshot),
        requested_amount=application.requested_amount,
        term_months=application.term_months,
        goal=application.goal,
        goal_label=GOAL_LABELS[application.goal],
        pipeline=build_stages(application),
        decision=decision_view(application),
        sign_attempts_left=5 - application.sign_attempts,
        signed_at=entered(Status.SIGNED),
        disbursed_at=entered(Status.DISBURSED),
        events=[EventResponse.model_validate(e) for e in application.events],
    )


def summary_view(application: Application) -> ApplicationSummary:
    return ApplicationSummary(
        id=application.id,
        status=application.status,
        status_label=STATUS_LABELS[application.status],
        created_at=application.created_at,
        company_name=application.company_snapshot["name"],
        requested_amount=application.requested_amount,
        approved_amount=application.offered_amount,
        goal=application.goal,
    )


def build_stages(application: Application) -> list[PipelineStage]:
    stages = []
    for status, code in PIPELINE_STAGES:
        entries = [e for e in application.events if e.to_status == status]
        started = entries[-1] if entries else None
        finished = next(
            (
                e
                for e in application.events
                if started and e.id > started.id and e.from_status == status
            ),
            None,
        )
        state = "pending"
        if started:
            state = "done" if finished else "in_progress"
            if finished and finished.to_status == Status.NEEDS_RECHECK:
                state = "failed"
        stages.append(
            PipelineStage(
                code=code,
                title=STATUS_LABELS[status],
                state=state,
                started_at=started.occurred_at if started else None,
                finished_at=finished.occurred_at if finished else None,
            )
        )
    return stages
