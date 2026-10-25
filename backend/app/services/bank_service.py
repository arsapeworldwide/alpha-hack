from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db.models import Application, utc_now
from app.domain.annuity import loan_totals
from app.domain.decision import three_months_later
from app.domain.scoring import annual_rate
from app.domain.state_machine import Actor, Status, check_transition
from app.schemas.bank import BankDecisionRequest
from app.services.application_service import get_application, transition


def review_application(
    session: Session,
    application_id: str,
    payload: BankDecisionRequest,
    reviewer: str = "legacy-bank-token",
) -> Application:
    application = get_application(session, application_id)
    target = Status.APPROVED if payload.action == "approve" else Status.REJECTED
    check_transition(application.status, target, Actor.BANK)
    previous = {
        "status": application.status,
        "score": application.score,
        "annual_rate": str(application.rate) if application.rate is not None else None,
        "amount": application.offered_amount,
        "rejection_reason": application.rejection_reason,
    }
    if target == Status.APPROVED:
        approve_application(application)
    else:
        reject_application(application)
    application.manual_decision = True
    application.updated_at = utc_now()
    transition(
        session,
        application,
        target,
        Actor.BANK,
        {
            "action": payload.action,
            "comment": payload.comment,
            "reviewer": reviewer,
            "previous_decision": previous,
            "offer": {
                "amount": application.offered_amount,
                "annual_rate": str(application.rate) if application.rate is not None else None,
            },
        },
    )
    session.commit()
    return application


def approve_application(application: Application) -> None:
    if application.score is None:
        raise AppError(
            409,
            "BANK_SCORING_REQUIRED",
            "Одобрение возможно после завершения проверок и расчёта скоринга.",
        )
    if application.score < 45:
        raise AppError(
            409,
            "BANK_RATE_UNAVAILABLE",
            "В SPEC не задана ставка для оценки ниже 45. Ручное одобрение недоступно.",
        )
    rate = annual_rate(application.score, application.goal)
    amount = application.requested_amount
    payment, _, overpayment = loan_totals(amount, rate, application.term_months)
    application.rate = rate
    application.offered_amount = amount
    application.monthly_payment = payment
    application.overpayment = overpayment
    application.rejection_reason = None
    application.recommendations = []
    application.reapply_date = None


def reject_application(application: Application) -> None:
    application.rate = None
    application.offered_amount = None
    application.monthly_payment = None
    application.overpayment = None
    application.rejection_reason = "Отказ по результатам ручного рассмотрения сотрудником банка"
    application.recommendations = [
        "Ознакомьтесь с комментарием сотрудника в журнале заявки.",
        "Проверьте долговую нагрузку и подготовьте обновлённые данные перед повторной подачей.",
    ]
    application.reapply_date = three_months_later(datetime.now(UTC).date())
