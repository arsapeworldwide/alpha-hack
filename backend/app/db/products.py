from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.models import Base


class Product(Base):
    __tablename__ = "products"

    code: Mapped[str] = mapped_column(String(30), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    goal: Mapped[str] = mapped_column(String(30))
    description: Mapped[str] = mapped_column(String(300))
    min_amount: Mapped[int]
    max_amount: Mapped[int]
    min_term: Mapped[int]
    max_term: Mapped[int]
    base_rate: Mapped[int]
    auto_limit: Mapped[int]


PRODUCTS = (
    dict(
        code="WORKING_CAPITAL",
        name="Оборотный кредит",
        goal="working_capital",
        description="На закупки, сезонные расходы и развитие оборота",
        min_amount=300_000,
        max_amount=15_000_000,
        min_term=3,
        max_term=36,
        base_rate=19,
        auto_limit=12_000_000,
    ),
    dict(
        code="INVEST",
        name="Кредит на оборудование",
        goal="equipment",
        description="На покупку оборудования и расширение производства",
        min_amount=300_000,
        max_amount=15_000_000,
        min_term=3,
        max_term=36,
        base_rate=17,
        auto_limit=5_000_000,
    ),
    dict(
        code="OVERDRAFT",
        name="Овердрафт",
        goal="cash_gap",
        description="На короткий кассовый разрыв",
        min_amount=300_000,
        max_amount=5_000_000,
        min_term=3,
        max_term=12,
        base_rate=21,
        auto_limit=5_000_000,
    ),
)


def seed_products(session):
    for values in PRODUCTS:
        if session.get(Product, values["code"]) is None:
            session.add(Product(**values))
    session.commit()
