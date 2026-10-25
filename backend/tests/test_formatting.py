from decimal import Decimal

import pytest

from app.domain.formatting import percent, rubles, years


@pytest.mark.parametrize(
    "age,expected",
    [
        (0, "0 лет"),
        (1, "1 год"),
        (3, "3 года"),
        (5, "5 лет"),
        (11, "11 лет"),
        (14, "14 лет"),
        (21, "21 год"),
        (22, "22 года"),
        (25, "25 лет"),
    ],
)
def test_year_endings(age, expected):
    assert years(age) == expected


def test_russian_money_and_percent():
    assert rubles(180_000_000) == "180 000 000 ₽"
    assert percent(Decimal("2.666666")) == "2,67%"
    assert percent(Decimal("20.00")) == "20%"
    assert percent(Decimal("111.11"), 0) == "111%"
