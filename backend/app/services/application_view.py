from app.db.models import Application
from app.domain.state_machine import STATUS_LABELS, Status
from app.schemas.applications import (
    ApplicationResponse,
    DecisionResponse,
    EventResponse,
    FactorResponse,
    LoanParameters,
    PipelineStage,
)
from app.schemas.companies import CompanyResponse

PIPELINE_STAGES = (Status.SUBMITTED, Status.CHECKING_EGRUL, Status.CHECKING_BKI, Status.SCORING)
DECISION_STATUSES = {Status.APPROVED, Status.COUNTER_OFFER, Status.REJECTED}


def application_view(application: Application) -> ApplicationResponse:
    decision_status = next(
        (
            event.to_status
            for event in reversed(application.events)
            if event.to_status in DECISION_STATUSES
        ),
        None,
    )
    decision = None
    if decision_status is not None:
        decision = DecisionResponse(
            status=decision_status,
            annual_rate=application.rate,
            amount=application.offered_amount,
            monthly_payment=application.monthly_payment,
            overpayment=application.overpayment,
            manual=application.manual_decision,
        )
    return ApplicationResponse(
        id=application.id,
        status=application.status,
        status_label=STATUS_LABELS[application.status],
        message=(
            "БКИ временно недоступно. Заявка сохранена. Проверка продолжится после "
            "восстановления БКИ и перезапуска сервиса."
            if application.status == Status.NEEDS_RECHECK
            else None
        ),
        created_at=application.created_at,
        updated_at=application.updated_at,
        company=CompanyResponse.model_validate(application.company_snapshot),
        parameters=LoanParameters(
            requested_amount=application.requested_amount,
            term_months=application.term_months,
            goal=application.goal,
        ),
        stages=build_stages(application),
        decision=decision,
        score=application.score,
        factors=[FactorResponse.model_validate(f) for f in application.factors],
        rejection_reason=application.rejection_reason,
        recommendations=application.recommendations,
        reapply_date=application.reapply_date,
        sign_attempts_remaining=5 - application.sign_attempts,
        events=[EventResponse.model_validate(e) for e in application.events],
    )


def build_stages(application: Application) -> list[PipelineStage]:
    stages = []
    for code in PIPELINE_STAGES:
        entries = [e for e in application.events if e.to_status == code]
        started = entries[-1] if entries else None
        finished = next(
            (
                e
                for e in application.events
                if started and e.id > started.id and e.from_status == code
            ),
            None,
        )
        state = "pending"
        if started:
            state = "completed" if finished else "active"
            if finished and finished.to_status == Status.NEEDS_RECHECK:
                state = "failed"
        stages.append(
            PipelineStage(
                code=code,
                name=STATUS_LABELS[code],
                state=state,
                started_at=started.occurred_at if started else None,
                finished_at=finished.occurred_at if finished else None,
            )
        )
    return stages
