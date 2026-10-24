from dataclasses import dataclass
from decimal import Decimal
from enum import StrEnum


class CreditHistory(StrEnum):
    EXCELLENT = "excellent"
    FAIR = "fair"
    POOR = "poor"


class Segment(StrEnum):
    RETAIL = "retail"
    SERVICES = "services"
    PRODUCTION = "production"
    GENERAL = "general"


class Goal(StrEnum):
    WORKING_CAPITAL = "working_capital"
    EQUIPMENT = "equipment"
    CASH_GAP = "cash_gap"


@dataclass(frozen=True)
class ScoringInput:
    annual_revenue: int
    monthly_payments: int
    credit_history: CreditHistory
    business_age_years: int
    requested_amount: int
    term_months: int
    goal: Goal

    def __post_init__(self) -> None:
        for name in (
            "annual_revenue",
            "monthly_payments",
            "business_age_years",
            "requested_amount",
            "term_months",
        ):
            if type(getattr(self, name)) is not int:
                raise ValueError(f"{name}: требуется целое число")
        if self.annual_revenue <= 0:
            raise ValueError("Годовая выручка должна быть положительной")
        if self.monthly_payments < 0 or self.business_age_years < 0:
            raise ValueError("Платежи и возраст бизнеса не могут быть отрицательными")
        if not 300_000 <= self.requested_amount <= 15_000_000:
            raise ValueError("Сумма должна быть от 300 000 до 15 000 000 рублей")
        if not 3 <= self.term_months <= 36:
            raise ValueError("Срок должен быть от 3 до 36 месяцев")
        CreditHistory(self.credit_history)
        Goal(self.goal)
        if self.goal == Goal.CASH_GAP and self.term_months > 12:
            raise ValueError("Для кассового разрыва срок не более 12 месяцев")


@dataclass(frozen=True)
class Factor:
    code: str
    name: str
    points: Decimal
    maximum: int
    explanation: str


@dataclass(frozen=True)
class ScoringResult:
    score: int
    factors: tuple[Factor, ...]
