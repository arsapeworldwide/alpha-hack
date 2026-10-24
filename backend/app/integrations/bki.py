from abc import ABC, abstractmethod
from dataclasses import dataclass

from sqlalchemy.orm import Session, sessionmaker

from app.db.models import Company
from app.domain.types import CreditHistory


class IntegrationUnavailable(Exception):
    pass


@dataclass(frozen=True)
class BkiReport:
    credit_history: CreditHistory
    monthly_payments: int


class BkiClient(ABC):
    @abstractmethod
    def check(self, inn: str) -> BkiReport:
        pass


class BkiSimulator(BkiClient):
    def __init__(self, session_factory: sessionmaker[Session], simulate_failure: bool = False):
        self.session_factory = session_factory
        self.simulate_failure = simulate_failure

    def check(self, inn: str) -> BkiReport:
        if self.simulate_failure:
            raise IntegrationUnavailable("БКИ временно недоступно")
        with self.session_factory() as session:
            company = session.get(Company, inn)
            if company is None:
                raise IntegrationUnavailable("В синтетическом БКИ нет сведений о компании")
            return BkiReport(company.credit_history, company.monthly_payments)
