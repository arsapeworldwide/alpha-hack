from typing import Annotated

from fastapi import APIRouter, Query, Request

from app.core.errors import AppError
from app.schemas.companies import Inn, RegistryCompanyResponse

router = APIRouter(prefix="/companies", tags=["companies"])


@router.get("/lookup", response_model=RegistryCompanyResponse)
async def lookup_company(request: Request, inn: Annotated[Inn, Query()]):
    company = request.app.state.pipeline.egrul.lookup(inn)
    if company is None:
        raise AppError(
            404,
            "COMPANY_NOT_FOUND",
            "Компания не найдена в синтетическом реестре. Проверьте ИНН или выберите демо-профиль.",
        )
    return company
