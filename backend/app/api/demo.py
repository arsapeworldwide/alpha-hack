from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import delete, func, select

from app.api.dependencies import DbSession, PipelineDependency
from app.db.models import Application, Company
from app.schemas.companies import CompanyResponse

router = APIRouter(tags=["demo"])


class ResetResponse(BaseModel):
    deleted_applications: int
    message: str


@router.get("/demo-profiles", response_model=list[CompanyResponse])
async def demo_profiles(session: DbSession):
    return list(session.scalars(select(Company).order_by(Company.annual_revenue.desc())))


@router.post("/demo/reset", response_model=ResetResponse)
async def reset_demo(session: DbSession, pipeline: PipelineDependency):
    async with pipeline.lock:
        await pipeline.cancel_all()
        count = session.scalar(select(func.count()).select_from(Application))
        session.execute(delete(Application))
        session.commit()
        return ResetResponse(
            deleted_applications=count, message="Демо-заявки удалены. Seed сохранён."
        )
