from abc import ABC, abstractmethod

from sqlalchemy.orm import Session, sessionmaker

from app.db.models import Company
from app.schemas.companies import CompanyResponse


class EgrulClient(ABC):
    @abstractmethod
    def lookup(self, inn: str) -> CompanyResponse | None:
        pass


class EgrulSimulator(EgrulClient):
    def __init__(self, session_factory: sessionmaker[Session]):
        self.session_factory = session_factory

    def lookup(self, inn: str) -> CompanyResponse | None:
        with self.session_factory() as session:
            company = session.get(Company, inn)
            return CompanyResponse.model_validate(company) if company else None
