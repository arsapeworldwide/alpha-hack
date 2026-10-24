from dataclasses import replace
from decimal import Decimal

import pytest
from conftest import load_scoring_cases

from app.domain.scoring import annual_rate, calculate_score
from app.domain.types import Goal, ScoringInput

CASES = load_scoring_cases()


@pytest.mark.parametrize("case", CASES["profiles"], ids=lambda c: c["id"])
def test_reference_scores(case):
    result = calculate_score(ScoringInput(**case["input"]))
    assert result.score == case["expected"]["score"]
    assert len(result.factors) == 5
    assert sum(f.maximum for f in result.factors) == 100
    assert all(0 <= f.points <= f.maximum and f.explanation for f in result.factors)
    if "factor_points" in case["expected"]:
        assert [f.points for f in result.factors] == [
            Decimal(p) for p in case["expected"]["factor_points"]
        ]


@pytest.mark.parametrize(
    "score,premium", [(45, "5"), (59, "5"), (60, "2.5"), (79, "2.5"), (80, "0"), (100, "0")]
)
@pytest.mark.parametrize(
    "goal,base", [(Goal.WORKING_CAPITAL, 19), (Goal.EQUIPMENT, 17), (Goal.CASH_GAP, 21)]
)
def test_rate_thresholds(score, premium, goal, base):
    assert annual_rate(score, goal) == Decimal(base) + Decimal(premium)


@pytest.mark.parametrize("score", [44, 101])
def test_no_rate_outside_eligible_scores(score):
    with pytest.raises(ValueError):
        annual_rate(score, Goal.EQUIPMENT)


@pytest.mark.parametrize("case", CASES["invalid_requests"], ids=lambda c: c["id"])
def test_invalid_requests(case):
    with pytest.raises(ValueError):
        ScoringInput(**(CASES["profiles"][0]["input"] | case["overrides"]))


@pytest.mark.parametrize(
    "changes",
    [
        {"annual_revenue": 0},
        {"annual_revenue": -1},
        {"monthly_payments": -1},
        {"business_age_years": -1},
        {"requested_amount": 300000.0},
        {"term_months": True},
        {"credit_history": "unknown"},
        {"goal": "unknown"},
    ],
)
def test_domain_rejects_bad_values(changes):
    with pytest.raises(ValueError):
        ScoringInput(**(CASES["profiles"][0]["input"] | changes))


def test_round_total_not_individual_factors():
    data = replace(ScoringInput(**CASES["profiles"][0]["input"]), monthly_payments=437_500)
    result = calculate_score(data)
    assert result.factors[1].points == Decimal("26.5")
    assert result.score == 97


@pytest.mark.parametrize(
    "revenue,expected",
    [
        (9_999_999, 4),
        (10_000_000, 8),
        (19_999_999, 8),
        (20_000_000, 12),
        (50_000_000, 16),
        (100_000_000, 20),
    ],
)
def test_revenue_tiers(revenue, expected):
    data = replace(ScoringInput(**CASES["profiles"][0]["input"]), annual_revenue=revenue)
    assert calculate_score(data).factors[2].points == expected


@pytest.mark.parametrize("age,expected", [(0, 0), (1, 4), (2, 4), (3, 7), (4, 7), (5, 10)])
def test_business_age_tiers(age, expected):
    data = replace(ScoringInput(**CASES["profiles"][0]["input"]), business_age_years=age)
    assert calculate_score(data).factors[3].points == expected


@pytest.mark.parametrize(
    "amount,expected",
    [
        (1_000_000, 5),
        (1_000_001, 3),
        (3_000_000, 3),
        (3_000_001, 1),
        (6_000_000, 1),
        (6_000_001, 0),
    ],
)
def test_amount_share_tiers(amount, expected):
    data = replace(
        ScoringInput(**CASES["profiles"][0]["input"]),
        annual_revenue=10_000_000,
        requested_amount=amount,
    )
    assert calculate_score(data).factors[4].points == expected
