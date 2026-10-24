import hashlib
import json
from secrets import compare_digest

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db.models import Application, ApplicationEvent, Company
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
    session.add(
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
    company = session.get(Company, payload.inn)
    if company is None:
        raise AppError(404, "COMPANY_NOT_FOUND", "В демо-реестре компания не найдена.")
    application = Application(
        company_inn=payload.inn,
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
        ApplicationEvent(
            application_id=application.id,
            from_status=None,
            to_status=Status.DRAFT,
            actor=Actor.CLIENT,
            details={"synthetic": True},
        )
    )
    transition(session, application, Status.SUBMITTED, Actor.CLIENT)
    session.commit()
    return application, True


def accept_offer(session: Session, application_id: str) -> Application:
    application = get_application(session, application_id)
    transition(session, application, Status.OFFER_ACCEPTED, Actor.CLIENT)
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
            {"attempts_remaining": 0},
        )
    if not compare_digest(code, "1234"):
        application.sign_attempts += 1
        session.commit()
        raise AppError(
            400,
            "INVALID_SIGN_CODE",
            "Неверный код подписания.",
            {"attempts_remaining": 5 - application.sign_attempts},
        )
    transition(session, application, Status.SIGNED, Actor.CLIENT)
    session.commit()
    return application
