from functools import lru_cache

from sqlalchemy.orm import Session

from app.core.passwords import hash_password
from app.db.access_models import Membership, User
from app.db.seed_data import COMPANIES, REGISTRY_EXTRAS

DEMO_PASSWORD = "demo-credit-2026"
DEMO_USERS = (
    ("director", "Директор демо-группы", "client_owner", "Все три кредитных сценария"),
    ("retail-owner", "Директор Альфа Ритейл", "client_owner", "Только компания Альфа Ритейл"),
    ("services-owner", "ИП Иванов", "client_owner", "Встречное предложение"),
    ("production-owner", "Директор Вектора", "client_owner", "Отказ и рекомендации"),
    ("accountant", "Бухгалтер Альфа Ритейл", "client_accountant", "Просмотр без права подписи"),
    ("underwriter", "Сотрудник банка", "underwriter", "Очередь и ручное решение"),
)


@lru_cache
def demo_password_hash() -> str:
    return hash_password(DEMO_PASSWORD)


def seed_access(session: Session) -> None:
    all_inns = [c["inn"] for c in (*COMPANIES, *REGISTRY_EXTRAS)]
    memberships = {
        "director": all_inns,
        "retail-owner": ["7712345678"],
        "accountant": ["7712345678"],
        "services-owner": ["500100732259"],
        "production-owner": ["7723456789"],
        "underwriter": [],
    }
    for login, name, role, _ in DEMO_USERS:
        if session.get(User, login) is None:
            session.add(
                User(
                    login=login,
                    full_name=name,
                    role=role,
                    password_hash=demo_password_hash(),
                    is_demo=True,
                )
            )
            session.flush()
        for inn in memberships[login]:
            if session.get(Membership, (login, inn)) is None:
                session.add(Membership(user_login=login, company_inn=inn))
    session.commit()
