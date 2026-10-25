from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.db.models import Application, ScoringFactor
from app.db.products import PRODUCTS, Product
from app.db.workflow_models import ApplicationWorkflow
from app.domain.decision import make_decision, three_months_later
from app.domain.state_machine import Actor, Status
from app.domain.types import ScoringInput
from app.integrations.bki import BkiClient, IntegrationUnavailable
from app.integrations.egrul import EgrulClient
from app.services.application_service import transition


def advance_pipeline(
    session: Session,
    application: Application,
    egrul: EgrulClient,
    bki: BkiClient,
) -> bool:
    match application.status:
        case Status.SUBMITTED:
            target = Status.CHECKING_EGRUL
        case Status.CHECKING_EGRUL:
            company = egrul.lookup(application.company_inn)
            if company is None:
                application.rejection_reason = "В демо-реестре компания не найдена"
                application.recommendations = ["Проверьте ИНН.", "Выберите демо-профиль."]
                application.reapply_date = three_months_later(datetime.now(UTC).date())
                target = Status.REJECTED
            else:
                application.company_snapshot = company.model_dump(mode="json")
                target = Status.CHECKING_BKI
        case Status.CHECKING_BKI:
            try:
                report = bki.check(application.company_inn)
            except IntegrationUnavailable:
                transition(
                    session,
                    application,
                    Status.NEEDS_RECHECK,
                    Actor.SYSTEM,
                    {"code": "BKI_UNAVAILABLE", "retry_on_restart": True},
                )
                session.commit()
                return False
            application.company_snapshot = {
                **application.company_snapshot,
                "credit_history": report.credit_history,
                "monthly_payments": report.monthly_payments,
            }
            target = Status.SCORING
        case Status.SCORING:
            target = save_decision(session, application)
        case Status.NEEDS_RECHECK:
            target = Status.CHECKING_BKI
        case Status.SIGNED:
            target = Status.DISBURSED
        case _:
            return False
    transition(session, application, target, Actor.SYSTEM)
    session.commit()
    return target in {Status.CHECKING_EGRUL, Status.CHECKING_BKI, Status.SCORING}


def save_decision(session: Session, application: Application) -> Status:
    company = application.company_snapshot
    data = ScoringInput(
        annual_revenue=company["annual_revenue"],
        monthly_payments=company["monthly_payments"],
        credit_history=company["credit_history"],
        business_age_years=company["business_age_years"],
        requested_amount=application.requested_amount,
        term_months=application.term_months,
        goal=application.goal,
    )
    result = make_decision(data, datetime.now(UTC).date())
    application.manual_decision = False
    application.score = result.scoring.score
    application.rate = result.rate
    application.offered_amount = result.amount
    application.monthly_payment = result.monthly_payment
    application.overpayment = result.overpayment
    application.rejection_reason = result.rejection_reason
    application.recommendations = list(result.recommendations)
    application.reapply_date = result.reapply_date
    # При повторной проверке старые коды нужно удалить до вставки новых: они уникальны.
    application.factors.clear()
    session.flush()
    application.factors = [
        ScoringFactor(
            code=f.code,
            name=f.name,
            points=str(f.points),
            maximum=f.maximum,
            explanation=f.explanation,
        )
        for f in result.scoring.factors
    ]
    workflow = session.get(ApplicationWorkflow, application.id)
    code = (
        workflow.product_code
        if workflow and workflow.product_code
        else next(p["code"] for p in PRODUCTS if p["goal"] == application.goal)
    )
    product = session.get(Product, code)
    if (
        result.amount
        and product
        and (
            result.amount > product.auto_limit
            or (45 <= result.scoring.score < 60 and result.amount > 5_000_000)
        )
    ):
        return Status.MANUAL_REVIEW
    return result.status
