from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select

from app.api.dependencies import DbSession, PipelineDependency
from app.core.errors import ErrorResponse
from app.core.security import require_bank_token
from app.db.models import Application
from app.domain.state_machine import BANK_REVIEW_STATUSES
from app.schemas.bank import BankDecisionRequest
from app.services.application_service import get_application
from app.services.bank_service import review_application
from app.services.bank_view import BankApplicationResponse, bank_view

router = APIRouter(
    prefix="/bank/applications",
    tags=["bank"],
    dependencies=[Depends(require_bank_token)],
    responses={401: {"model": ErrorResponse}},
)


@router.get("", response_model=list[BankApplicationResponse])
async def bank_queue(
    session: DbSession,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    view: Literal["reviewable", "needs_decision", "all"] = "reviewable",
):
    query = select(Application)
    if view == "needs_decision":
        query = query.where(
            Application.status.in_({"COUNTER_OFFER", "NEEDS_RECHECK", "MANUAL_REVIEW"})
        )
    elif view == "reviewable":
        query = query.where(Application.status.in_(BANK_REVIEW_STATUSES))
    applications = session.scalars(
        query.order_by(Application.updated_at, Application.id).limit(limit).offset(offset)
    )
    return [bank_view(a) for a in applications]


@router.post("/{id}/decision", response_model=BankApplicationResponse)
async def bank_decision(
    id: str,
    payload: BankDecisionRequest,
    session: DbSession,
    pipeline: PipelineDependency,
    reviewer: Annotated[str, Depends(require_bank_token)],
):
    async with pipeline.lock:
        return bank_view(review_application(session, str(id), payload, reviewer))


@router.get("/{id}", response_model=BankApplicationResponse)
async def bank_detail(id: str, session: DbSession):
    return bank_view(get_application(session, id))
