from decimal import Decimal

import pytest

from app.domain.annuity import annuity_payment, loan_totals, maximum_amount, round_rubles


@pytest.mark.parametrize(
    "amount,rate,months,payment,overpayment",
    [
        (10_000_000, "19", 36, 366_560, 3_196_160),
        (2_500_000, "24", 36, 98_082, 1_030_952),
        (1_000_000, "21", 12, 93_114, 117_368),
    ],
)
def test_known_payments(amount, rate, months, payment, overpayment):
    raw = annuity_payment(amount, Decimal(rate), months)
    assert round_rubles(raw) == payment
    assert loan_totals(amount, Decimal(rate), months) == (payment, payment * months, overpayment)
    assert abs(maximum_amount(raw, Decimal(rate), months) - amount) < Decimal("0.000001")


def test_zero_rate_and_zero_capacity():
    assert annuity_payment(300_000, Decimal(0), 12) == 25_000
    assert maximum_amount(Decimal(25_000), Decimal(0), 12) == 300_000
    assert maximum_amount(Decimal(0), Decimal(19), 36) == 0
    assert maximum_amount(Decimal(-1), Decimal(19), 36) == 0


@pytest.mark.parametrize("value,expected", [("1.49", 1), ("1.5", 2), ("2.5", 3)])
def test_half_up(value, expected):
    assert round_rubles(Decimal(value)) == expected


@pytest.mark.parametrize(
    "rate,months",
    [
        (Decimal(-1), 12),
        (Decimal(19), 0),
        (Decimal("NaN"), 12),
        (Decimal("Infinity"), 12),
        (19.0, 12),
        (Decimal(19), True),
    ],
)
def test_invalid_financial_inputs(rate, months):
    with pytest.raises(ValueError):
        annuity_payment(300_000, rate, months)
