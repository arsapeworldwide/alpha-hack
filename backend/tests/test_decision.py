from dataclasses import replace
from datetime import date
from decimal import Decimal

import pytest
from conftest import load_scoring_cases

from app.domain.decision import choose_outcome, make_decision, three_months_later
from app.domain.types import ScoringInput

CASES = load_scoring_cases()


@pytest.mark.parametrize("case", CASES["profiles"], ids=lambda c: c["id"])
def test_reference_decisions(case):
    result = make_decision(ScoringInput(**case["input"]), date.fromisoformat(CASES["as_of"]))
    for field, expected in case["expected"].items():
        if field == "score":
            assert result.scoring.score == expected
        elif field == "factor_points":
            continue
        elif field in {"rate", "capacity"} and expected is not None:
            assert getattr(result, field) == Decimal(expected)
        elif field == "reapply_date":
            assert result.reapply_date == date.fromisoformat(expected)
        else:
            assert getattr(result, field) == expected
    if result.status == "REJECTED":
        assert 2 <= len(result.recommendations) <= 3
        assert result.reapply_date == date(2027, 1, 24)
        assert result.amount is result.monthly_payment is result.overpayment is None


@pytest.mark.parametrize("case", CASES["decision_boundaries"], ids=lambda c: c["id"])
def test_decision_boundaries(case):
    assert choose_outcome(
        case["score"], Decimal(case["capacity"]), Decimal(case["maximum"]), case["requested_amount"]
    ) == (case["status"], case["amount"])


@pytest.mark.parametrize(
    "start,expected",
    [
        (date(2026, 11, 30), date(2027, 2, 28)),
        (date(2027, 11, 30), date(2028, 2, 29)),
        (date(2026, 1, 31), date(2026, 4, 30)),
    ],
)
def test_calendar_months(start, expected):
    assert three_months_later(start) == expected


@pytest.mark.parametrize(
    "changes,reason",
    [
        ({"monthly_payments": 0}, "Слабая кредитная история"),
        (
            {
                "monthly_payments": 15_000,
                "credit_history": "fair",
                "business_age_years": 0,
                "annual_revenue": 1_000_000,
            },
            "Недостаточный уровень надёжности по итогам скоринга",
        ),
        (
            {
                "annual_revenue": 24_000_000,
                "monthly_payments": 499_000,
                "credit_history": "excellent",
            },
            "Запрашиваемая сумма превышает платёжные возможности компании",
        ),
    ],
)
def test_rejection_reason_priority(changes, reason):
    data = replace(ScoringInput(**CASES["profiles"][2]["input"]), **changes)
    assert make_decision(data, date(2026, 10, 24)).rejection_reason == reason
