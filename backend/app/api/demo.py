from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import delete, func, select

from app.api.dependencies import DbSession, PipelineDependency
from app.db.models import Application, Company
from app.schemas.companies import CompanyResponse, DemoProfileResponse

router = APIRouter(tags=["demo"])


class ResetResponse(BaseModel):
    status: str = "ok"
    removed_applications: int


@router.get("/demo-profiles", response_model=list[DemoProfileResponse])
async def demo_profiles(session: DbSession):
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
            company=CompanyResponse.model_validate(company),
        )
        for inn, code, label, risk in profiles
        if (company := session.get(Company, inn))
    ]


@router.post("/demo/reset", response_model=ResetResponse)
async def reset_demo(session: DbSession, pipeline: PipelineDependency):
    async with pipeline.lock:
        await pipeline.cancel_all()
        count = session.scalar(select(func.count()).select_from(Application))
        session.execute(delete(Application))
        session.commit()
        return ResetResponse(removed_applications=count)
