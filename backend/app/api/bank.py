from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select

from app.api.dependencies import DbSession, PipelineDependency
from app.core.errors import ErrorResponse
from app.core.security import require_bank_token
from app.db.models import Application
from app.domain.state_machine import BANK_REVIEW_STATUSES
from app.schemas.applications import ApplicationResponse
from app.schemas.bank import BankDecisionRequest
from app.services.application_view import application_view
from app.services.bank_service import review_application

router = APIRouter(
    prefix="/bank/applications",
    tags=["bank"],
    dependencies=[Depends(require_bank_token)],
    responses={401: {"model": ErrorResponse}},
)


@router.get("", response_model=list[ApplicationResponse])
async def bank_queue(
    session: DbSession,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    applications = session.scalars(
        select(Application)
        .where(
            Application.status.in_(BANK_REVIEW_STATUSES),
        )
        .order_by(Application.updated_at, Application.id)
        .limit(limit)
        .offset(offset)
    )
    return [application_view(a) for a in applications]


@router.post("/{id}/decision", response_model=ApplicationResponse)
async def bank_decision(
    id: UUID,
    payload: BankDecisionRequest,
    session: DbSession,
    pipeline: PipelineDependency,
):
    async with pipeline.lock:
        return application_view(review_application(session, str(id), payload))
