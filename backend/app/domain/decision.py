from calendar import monthrange
from dataclasses import dataclass
from datetime import date
from decimal import ROUND_FLOOR, Decimal

from app.domain.annuity import loan_totals, maximum_amount
from app.domain.scoring import annual_rate, calculate_score, debt_ratio, payment_capacity
from app.domain.state_machine import Status
from app.domain.types import CreditHistory, ScoringInput, ScoringResult


@dataclass(frozen=True)
class Decision:
    status: Status
    scoring: ScoringResult
    rate: Decimal | None
    amount: int | None
    monthly_payment: int | None
    overpayment: int | None
    capacity: Decimal
    maximum_amount: Decimal | None
    rejection_reason: str | None = None
    recommendations: tuple[str, ...] = ()
    reapply_date: date | None = None


def choose_outcome(
    score: int,
    capacity: Decimal,
    maximum: Decimal,
    requested_amount: int,
) -> tuple[Status, int | None]:
    if score < 45 or capacity <= 0:
        return Status.REJECTED, None
    if maximum >= requested_amount:
        return Status.APPROVED, requested_amount
    offered = int((maximum / 100_000).to_integral_value(rounding=ROUND_FLOOR)) * 100_000
    if offered >= 300_000:
        return Status.COUNTER_OFFER, offered
    return Status.REJECTED, None


def three_months_later(today: date) -> date:
    month_index = today.year * 12 + today.month - 1 + 3
    year, month = divmod(month_index, 12)
    month += 1
    return date(year, month, min(today.day, monthrange(year, month)[1]))


def rejection_reason(data: ScoringInput, score: int) -> str:
    if debt_ratio(data) > Decimal("0.25") or payment_capacity(data) <= 0:
        return "Высокая долговая нагрузка"
    if data.credit_history == CreditHistory.POOR:
        return "Слабая кредитная история"
    if score < 45:
        return "Недостаточный уровень надёжности по итогам скоринга"
    return "Запрашиваемая сумма превышает платёжные возможности компании"


def make_decision(data: ScoringInput, today: date) -> Decision:
    scoring = calculate_score(data)
    capacity = payment_capacity(data)
    rate = annual_rate(scoring.score, data.goal) if scoring.score >= 45 else None
    maximum = maximum_amount(capacity, rate, data.term_months) if rate is not None else None
    status, amount = choose_outcome(
        scoring.score, capacity, maximum or Decimal(0), data.requested_amount
    )
    if status == Status.REJECTED:
        return Decision(
            status,
            scoring,
            None,
            None,
            None,
            None,
            capacity,
            maximum,
            rejection_reason(data, scoring.score),
            (
                "Снизьте текущие ежемесячные платежи по кредитам.",
                "Проверяйте кредитную историю и своевременно вносите платежи.",
                "Сопоставьте запрашиваемую сумму со стабильной выручкой бизнеса.",
            ),
            three_months_later(today),
        )
    assert amount is not None and rate is not None
    payment, _, overpayment = loan_totals(amount, rate, data.term_months)
    return Decision(
        status,
        scoring,
        rate,
        amount,
        payment,
        overpayment,
        capacity,
        maximum,
    )
