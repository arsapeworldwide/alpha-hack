from decimal import Decimal

from app.core.errors import AppError
from app.domain.annuity import loan_totals, round_rubles
from app.domain.formatting import rubles
from app.domain.scoring import annual_rate, payment_capacity
from app.services.application_view import scoring_input


def apply_offer(application, amount: int, term: int, comment: str) -> dict:
    if application.score is None:
        raise AppError(409, "BANK_SCORING_REQUIRED", "Дождитесь завершения скоринга.")
    if application.score < 45:
        raise AppError(409, "BANK_RATE_UNAVAILABLE", "Ставка не определена для оценки ниже 45.")
    if application.goal == "cash_gap" and term > 12:
        raise AppError(422, "VALIDATION_ERROR", "Для кассового разрыва срок не более 12 месяцев.")
    rate = annual_rate(application.score, application.goal)
    payment, _, overpayment = loan_totals(amount, rate, term)
    capacity = payment_capacity(scoring_input(application))
    excess = max(0, payment - round_rubles(capacity))
    if Decimal(payment) > capacity and not comment.strip():
        raise AppError(
            422,
            "VALIDATION_ERROR",
            f"Платёж превышает платёжную способность на {rubles(excess)} в месяц. "
            "Укажите обоснование.",
            {"field": "comment", "capacity_excess": excess},
        )
    application.rate = rate
    application.offered_amount = amount
    application.monthly_payment = payment
    application.overpayment = overpayment
    application.rejection_reason = None
    application.recommendations = []
    application.reapply_date = None
    return {
        "amount": amount,
        "annual_rate": str(rate),
        "term_months": term,
        "monthly_payment": payment,
        "capacity_excess": excess,
    }
