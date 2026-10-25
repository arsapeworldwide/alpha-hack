from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select

from app.api.dependencies import DbSession
from app.db.products import Product

router = APIRouter(prefix="/products", tags=["products"])


class ProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    code: str
    name: str
    goal: str
    description: str
    min_amount: int
    max_amount: int
    min_term: int
    max_term: int
    base_rate: int
    auto_limit: int


@router.get("", response_model=list[ProductResponse])
async def products(session: DbSession):
    return list(session.scalars(select(Product).order_by(Product.code)))
