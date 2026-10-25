from datetime import UTC, datetime

from app.domain.annuity import round_rubles
from app.domain.decision import make_decision
from app.domain.scoring import annual_rate
from app.schemas.applications import ApplicationResponse
from app.services.application_view import FACTOR_CODES, application_view, scoring_input


class BankApplicationResponse(ApplicationResponse):
    system_recommendation: dict | None
    waiting_minutes: int
    capacity_excess: int
    policy_rate: float | None


def bank_view(application) -> BankApplicationResponse:
    recommendation = None
    excess = 0
    if application.score is not None:
        result = make_decision(scoring_input(application), application.created_at.date())
        capacity = round_rubles(result.capacity)
        recommendation = {
            "outcome": result.status,
            "score": result.scoring.score,
            "amount": result.amount,
            "rate": float(result.rate) if result.rate is not None else None,
            "monthly_payment": result.monthly_payment,
            "term_months": application.term_months,
            "capacity": capacity,
            "factors": [
                {
                    "code": FACTOR_CODES.get(f.code, f.code),
                    "name": f.name,
                    "points": float(f.points),
                    "max_points": f.maximum,
                    "explanation": f.explanation,
                }
                for f in result.scoring.factors
            ],
        }
        excess = max(0, (application.monthly_payment or 0) - capacity)
    waiting = max(
        0,
        int((datetime.now(UTC) - application.updated_at.replace(tzinfo=UTC)).total_seconds() // 60),
    )
    return BankApplicationResponse(
        **application_view(application).model_dump(),
        system_recommendation=recommendation,
        waiting_minutes=waiting,
        capacity_excess=excess,
        policy_rate=float(annual_rate(application.score, application.goal))
        if application.score is not None and application.score >= 45
        else None,
    )
