import hashlib
import json
from secrets import compare_digest

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db.models import Application, ApplicationEvent, Company, utc_now
from app.db.products import PRODUCTS, Product
from app.db.workflow_models import ApplicationWorkflow
from app.domain.state_machine import Actor, Status, check_transition
from app.schemas.applications import CreateApplication
from app.schemas.companies import CompanyResponse


def get_application(session: Session, application_id: str) -> Application:
    application = session.get(Application, application_id)
    if application is None:
        raise AppError(404, "APPLICATION_NOT_FOUND", "Заявка не найдена.")
    return application


def transition(
    session: Session,
    application: Application,
    target: Status,
    actor: Actor,
    details: dict | None = None,
) -> None:
    check_transition(application.status, target, actor)
    # Журнал мог быть загружен для предыдущего решения: обновляем и коллекцию ответа.
    application.events.append(
        ApplicationEvent(
            application_id=application.id,
            from_status=application.status,
            to_status=target,
            actor=actor,
            details=details or {},
        )
    )
    application.status = target


def create_application(
    session: Session,
    payload: CreateApplication,
    idempotency_key: str | None,
) -> tuple[Application, bool]:
    fingerprint = hashlib.sha256(
        json.dumps(
            payload.model_dump(mode="json"),
            sort_keys=True,
            separators=(",", ":"),
        ).encode()
    ).hexdigest()
    if idempotency_key:
        existing = session.scalar(
            select(Application).where(
                Application.idempotency_key == idempotency_key,
            )
        )
        if existing:
            if existing.request_fingerprint != fingerprint:
                raise AppError(
                    409,
                    "IDEMPOTENCY_CONFLICT",
                    "Этот Idempotency-Key уже использован с другими параметрами.",
                )
            return existing, False
    company = session.get(Company, payload.company.inn)
    if company is None:
        raise AppError(404, "COMPANY_NOT_FOUND", "В демо-реестре компания не найдена.")
    code = payload.product_code or next(p["code"] for p in PRODUCTS if p["goal"] == payload.goal)
    product = session.get(Product, code)
    if product is None or product.goal != payload.goal:
        raise AppError(422, "VALIDATION_ERROR", "Выбранный продукт не соответствует цели.")
    if not (
        product.min_amount <= payload.requested_amount <= product.max_amount
        and product.min_term <= payload.term_months <= product.max_term
    ):
        raise AppError(422, "VALIDATION_ERROR", "Сумма или срок вне границ выбранного продукта.")
    application = Application(
        company_inn=payload.company.inn,
        company_snapshot=CompanyResponse.model_validate(company).model_dump(mode="json"),
        requested_amount=payload.requested_amount,
        term_months=payload.term_months,
        goal=payload.goal,
        idempotency_key=idempotency_key,
        request_fingerprint=fingerprint,
    )
    session.add(application)
    session.flush()
    session.add(
        ApplicationWorkflow(application_id=application.id, product_code=code, consent_at=utc_now())
    )
    session.add(
        ApplicationEvent(
            application_id=application.id,
            from_status=None,
            to_status=Status.DRAFT,
            actor=Actor.CLIENT,
            details={"synthetic": True},
        )
    )
    transition(
        session,
        application,
        Status.SUBMITTED,
        Actor.CLIENT,
        {"bki_consent": True, "product_code": code},
    )
    session.commit()
    return application, True


def accept_offer(session: Session, application_id: str) -> Application:
    application = get_application(session, application_id)
    transition(session, application, Status.OFFER_ACCEPTED, Actor.CLIENT)
    session.commit()
    return application


def retry_application(session: Session, application_id: str) -> Application:
    application = get_application(session, application_id)
    transition(session, application, Status.CHECKING_BKI, Actor.CLIENT, {"action": "retry"})
    session.commit()
    return application


def sign_application(session: Session, application_id: str, code: str) -> Application:
    application = get_application(session, application_id)
    check_transition(application.status, Status.SIGNED, Actor.CLIENT)
    if application.sign_attempts >= 5:
        raise AppError(
            429,
            "SIGN_ATTEMPTS_EXCEEDED",
            "Лимит попыток подписания исчерпан. Создайте новую демо-заявку.",
            {"attempts_left": 0},
        )
    if not compare_digest(code, "1234"):
        application.sign_attempts += 1
        session.commit()
        raise AppError(
            429 if application.sign_attempts == 5 else 400,
            "SIGN_ATTEMPTS_EXCEEDED" if application.sign_attempts == 5 else "INVALID_SIGN_CODE",
            "Неверный код подписания.",
            {"attempts_left": 5 - application.sign_attempts},
        )
    transition(session, application, Status.SIGNED, Actor.CLIENT)
    session.commit()
    return application
