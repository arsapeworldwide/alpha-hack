from fastapi import APIRouter, Request
from pydantic import BaseModel
from sqlalchemy import delete, func, select

from app.api.access import CurrentUser, require_demo
from app.api.dependencies import DbSession, PipelineDependency
from app.db.access_models import DemoFailure
from app.db.models import Application, Company
from app.db.workflow_models import ApplicationDocument
from app.schemas.auth import FailureSettings
from app.schemas.companies import DemoProfileResponse, RegistryCompanyResponse
from app.services.documents import document_path

router = APIRouter(tags=["demo"])


class ResetResponse(BaseModel):
    status: str = "ok"
    removed_applications: int


@router.get("/demo-profiles", response_model=list[DemoProfileResponse])
async def demo_profiles(session: DbSession, request: Request):
    if not request.app.state.settings.demo_mode:
        from app.core.errors import AppError

        raise AppError(404, "NOT_FOUND", "Демо-функция отключена.")
    profiles = (
        ("7712345678", "alfa-retail", "Идеальный", "ideal"),
        ("500100732259", "ivanov", "Средний", "medium"),
        ("7723456789", "vector", "Рискованный", "risky"),
    )
    return [
        DemoProfileResponse(
            id=code,
            label=f"{company.name} ({label})",
            risk_level=risk,
            company=RegistryCompanyResponse.model_validate(company),
        )
        for inn, code, label, risk in profiles
        if (company := session.get(Company, inn))
    ]


@router.post("/demo/reset", response_model=ResetResponse)
async def reset_demo(
    session: DbSession, pipeline: PipelineDependency, request: Request, user: CurrentUser
):
    require_demo(request, user, manage=True)
    async with pipeline.lock:
        await pipeline.cancel_all()
        count = session.scalar(select(func.count()).select_from(Application))
        paths = list(session.scalars(select(ApplicationDocument.path)))
        session.execute(delete(Application))
        session.merge(DemoFailure(source="bki", mode="ok"))
        session.commit()
        for filename in paths:
            document_path(request.app.state.settings.document_directory, filename).unlink(
                missing_ok=True
            )
        return ResetResponse(removed_applications=count)


@router.get("/demo/failures", response_model=FailureSettings)
async def failures(
    session: DbSession, pipeline: PipelineDependency, request: Request, user: CurrentUser
):
    require_demo(request, user)
    saved = session.get(DemoFailure, "bki")
    return FailureSettings(
        bki=saved.mode if saved else "down" if pipeline.settings.simulate_bki_failure else "ok"
    )


@router.post("/demo/failures", response_model=FailureSettings)
async def set_failures(
    payload: FailureSettings,
    session: DbSession,
    pipeline: PipelineDependency,
    request: Request,
    user: CurrentUser,
):
    require_demo(request, user, manage=True)
    async with pipeline.lock:
        session.merge(DemoFailure(source="bki", mode=payload.bki))
        session.commit()
    return payload
