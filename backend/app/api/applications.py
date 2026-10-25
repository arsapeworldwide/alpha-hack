from typing import Annotated

from fastapi import APIRouter, Header, Query, Response
from sqlalchemy import select

from app.api.access import CurrentUser, require_client, require_owner, visible_application
from app.api.dependencies import DbSession, PipelineDependency
from app.core.errors import AppError
from app.db.models import Application
from app.schemas.applications import (
    ApplicationResponse,
    ApplicationSummary,
    CreateApplication,
    SignRequest,
)
from app.services.application_service import (
    accept_offer,
    create_application,
    retry_application,
    sign_application,
)
from app.services.application_view import application_view, summary_view

router = APIRouter(prefix="/applications", tags=["applications"])
IdempotencyKey = Annotated[
    str | None,
    Header(min_length=1, max_length=200, pattern=r"^[!-~]+$"),
]


@router.post(
    "",
    status_code=201,
    response_model=ApplicationResponse,
    responses={200: {"model": ApplicationResponse, "description": "Повтор запроса"}},
)
async def submit_application(
    payload: CreateApplication,
    response: Response,
    session: DbSession,
    pipeline: PipelineDependency,
    user: CurrentUser,
    idempotency_key: IdempotencyKey = None,
):
    require_owner(user)
    if payload.company.inn not in user.company_inns:
        raise AppError(404, "COMPANY_NOT_FOUND", "Компания не найдена среди доступных вам.")
    async with pipeline.lock:
        if idempotency_key:
            from hashlib import sha256

            idempotency_key = sha256(f"{user.login}:{idempotency_key}".encode()).hexdigest()
        application, created = create_application(session, payload, idempotency_key)
        result = application_view(application)
        if not created:
            response.status_code = 200
        if created:
            pipeline.start(application.id)
        return result


@router.get("", response_model=list[ApplicationSummary])
async def application_history(
    session: DbSession,
    user: CurrentUser,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    require_client(user)
    applications = session.scalars(
        select(Application)
        .where(Application.company_inn.in_(user.company_inns))
        .order_by(
            Application.created_at.desc(),
            Application.id.desc(),
        )
        .limit(limit)
        .offset(offset)
    )
    return [summary_view(a) for a in applications]


@router.get("/{id}", response_model=ApplicationResponse)
async def application_detail(id: str, session: DbSession, user: CurrentUser):
    return application_view(visible_application(session, id, user))


@router.post("/{id}/accept-offer", response_model=ApplicationResponse)
async def accept_application_offer(
    id: str, session: DbSession, pipeline: PipelineDependency, user: CurrentUser
):
    visible_application(session, id, user)
    require_owner(user)
    async with pipeline.lock:
        return application_view(accept_offer(session, str(id)))


@router.post("/{id}/sign", response_model=ApplicationResponse)
async def sign(
    id: str,
    payload: SignRequest,
    session: DbSession,
    pipeline: PipelineDependency,
    user: CurrentUser,
):
    visible_application(session, id, user)
    require_owner(user)
    async with pipeline.lock:
        application = sign_application(session, str(id), payload.code)
        result = application_view(application)
        pipeline.start(application.id)
        return result


@router.post("/{id}/retry", response_model=ApplicationResponse)
async def retry(id: str, session: DbSession, pipeline: PipelineDependency, user: CurrentUser):
    visible_application(session, id, user)
    require_owner(user)
    async with pipeline.lock:
        application = retry_application(session, id)
        result = application_view(application)
        pipeline.start(application.id)
        return result
