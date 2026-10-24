from decimal import Decimal, localcontext

from app.domain.annuity import round_rubles
from app.domain.types import CreditHistory, Factor, Goal, ScoringInput, ScoringResult


def _tier(value: int | Decimal, thresholds: tuple[tuple[int, int], ...], default: int) -> int:
    return next((points for minimum, points in thresholds if value >= minimum), default)


def debt_ratio(data: ScoringInput) -> Decimal:
    with localcontext() as context:
        context.prec = 40
        return Decimal(data.monthly_payments) * 12 / data.annual_revenue


def payment_capacity(data: ScoringInput) -> Decimal:
    with localcontext() as context:
        context.prec = 40
        return Decimal(data.annual_revenue) / 48 - data.monthly_payments


def calculate_score(data: ScoringInput) -> ScoringResult:
    with localcontext() as context:
        context.prec = 40
        history = {CreditHistory.EXCELLENT: 35, CreditHistory.FAIR: 20, CreditHistory.POOR: 0}
        load = debt_ratio(data)
        load_points = 30 * min(Decimal(1), max(Decimal(0), 1 - load / Decimal("0.25")))
        revenue_points = _tier(
            data.annual_revenue,
            ((100_000_000, 20), (50_000_000, 16), (20_000_000, 12), (10_000_000, 8)),
            4,
        )
        age_points = _tier(data.business_age_years, ((5, 10), (3, 7), (1, 4)), 0)
        share = Decimal(data.requested_amount) / data.annual_revenue
        share_points = next(
            (
                points
                for limit, points in (("0.1", 5), ("0.3", 3), ("0.6", 1))
                if share <= Decimal(limit)
            ),
            0,
        )
        factors = (
            Factor(
                "history",
                "Кредитная история",
                Decimal(history[data.credit_history]),
                35,
                "Своевременные платежи по прежним кредитам повышают оценку.",
            ),
            Factor(
                "debt_load",
                "Долговая нагрузка",
                load_points,
                30,
                f"Текущие платежи составляют {load * 100:.2f}% месячной выручки; "
                "при нагрузке 25% и выше баллы не начисляются.",
            ),
            Factor(
                "revenue",
                "Годовая выручка",
                Decimal(revenue_points),
                20,
                f"Выручка {data.annual_revenue:,} рублей определяет запас для платежей.",
            ),
            Factor(
                "business_age",
                "Возраст бизнеса",
                Decimal(age_points),
                10,
                f"Бизнес работает {data.business_age_years} лет; "
                "более долгий срок повышает оценку.",
            ),
            Factor(
                "amount_share",
                "Сумма к выручке",
                Decimal(share_points),
                5,
                f"Запрашиваемая сумма составляет {share * 100:.2f}% годовой выручки.",
            ),
        )
        return ScoringResult(round_rubles(sum((f.points for f in factors), Decimal(0))), factors)


def annual_rate(score: int, goal: Goal) -> Decimal:
    if not 45 <= score <= 100:
        raise ValueError("Ставка определена только для оценки от 45 до 100")
    base = {Goal.WORKING_CAPITAL: 19, Goal.EQUIPMENT: 17, Goal.CASH_GAP: 21}[goal]
    premium = Decimal(0) if score >= 80 else Decimal("2.5") if score >= 60 else Decimal(5)
    return Decimal(base) + premium
