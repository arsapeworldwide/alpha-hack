from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import text

from app.api.dependencies import DbSession

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: str
    database: str
    synthetic: bool


@router.get("/health", response_model=HealthResponse)
async def health(session: DbSession):
    session.execute(text("SELECT 1"))
    return HealthResponse(status="ok", database="ok", synthetic=True)
