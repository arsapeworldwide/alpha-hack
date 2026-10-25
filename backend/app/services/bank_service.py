from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.db.models import Application, utc_now
from app.domain.decision import three_months_later
from app.domain.state_machine import Actor, Status, check_transition
from app.schemas.bank import BankDecisionRequest
from app.services.application_service import get_application, transition
from app.services.application_view import decision_view
from app.services.offer_terms import apply_offer


def review_application(
    session: Session,
    application_id: str,
    payload: BankDecisionRequest,
    reviewer: str = "legacy-bank-token",
) -> Application:
    application = get_application(session, application_id)
    target = {
        "approve": Status.APPROVED,
        "counter": Status.COUNTER_OFFER,
        "reject": Status.REJECTED,
        "request_info": Status.INFO_REQUESTED,
    }[payload.action]
    check_transition(application.status, target, Actor.BANK)
    previous_view = decision_view(application)
    previous = {
        "status": application.status,
        "score": application.score,
        "annual_rate": str(application.rate) if application.rate is not None else None,
        "amount": application.offered_amount,
        "rejection_reason": application.rejection_reason,
        "term_months": previous_view.term_months if previous_view else application.term_months,
        "monthly_payment": application.monthly_payment,
    }
    offer = None
    if target in {Status.APPROVED, Status.COUNTER_OFFER}:
        offer = apply_offer(
            application,
            payload.amount or application.requested_amount,
            payload.term_months or application.term_months,
            payload.comment,
        )
    elif target == Status.REJECTED:
        reject_application(application)
    else:
        from app.db.workflow_models import ApplicationWorkflow

        workflow = session.get(ApplicationWorkflow, application.id)
        if workflow is None:
            workflow = ApplicationWorkflow(application_id=application.id)
            session.add(workflow)
        workflow.document_checklist = list(dict.fromkeys(payload.checklist))
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
            "offer": offer,
            "checklist": payload.checklist,
        },
    )
    session.commit()
    return application


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
