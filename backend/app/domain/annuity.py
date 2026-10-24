from decimal import ROUND_HALF_UP, Decimal, localcontext


def round_rubles(value: Decimal) -> int:
    return int(value.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def present_value_factor(annual_rate: Decimal, term_months: int) -> Decimal:
    if not isinstance(annual_rate, Decimal) or not annual_rate.is_finite() or annual_rate < 0:
        raise ValueError("Ставка должна быть неотрицательным Decimal")
    if type(term_months) is not int or term_months <= 0:
        raise ValueError("Срок должен быть положительным целым числом")
    with localcontext() as context:
        context.prec = 40
        monthly_rate = annual_rate / Decimal(1200)
        if monthly_rate == 0:
            return Decimal(term_months)
        return (1 - (1 + monthly_rate) ** -term_months) / monthly_rate


def annuity_payment(amount: int, annual_rate: Decimal, term_months: int) -> Decimal:
    if type(amount) is not int or amount < 0:
        raise ValueError("Сумма должна быть неотрицательным целым числом")
    with localcontext() as context:
        context.prec = 40
        return Decimal(amount) / present_value_factor(annual_rate, term_months)


def maximum_amount(capacity: Decimal, annual_rate: Decimal, term_months: int) -> Decimal:
    if not isinstance(capacity, Decimal) or not capacity.is_finite():
        raise ValueError("Платёжная способность должна быть конечным Decimal")
    with localcontext() as context:
        context.prec = 40
        return max(Decimal(0), capacity) * present_value_factor(annual_rate, term_months)
