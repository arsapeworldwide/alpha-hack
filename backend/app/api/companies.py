from typing import Annotated

from fastapi import APIRouter, Query, Request

from app.schemas.companies import CompanyLookupResponse, Inn

router = APIRouter(prefix="/companies", tags=["companies"])


@router.get("/lookup", response_model=CompanyLookupResponse)
async def lookup_company(request: Request, inn: Annotated[Inn, Query()]):
    company = request.app.state.pipeline.egrul.lookup(inn)
    return CompanyLookupResponse(
        found=company is not None,
        company=company,
        message="Компания найдена в демо-реестре."
        if company
        else "В демо-реестре компания не найдена. Выберите один из демо-профилей.",
    )
