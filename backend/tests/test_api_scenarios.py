from datetime import UTC, datetime
from decimal import Decimal

import pytest
from conftest import application_payload, load_scoring_cases, wait_for_status

from app.domain.decision import three_months_later


@pytest.mark.parametrize("case", load_scoring_cases()["profiles"][:3], ids=lambda c: c["id"])
def test_three_outcomes_end_to_end(client, case):
    response = client.post("/api/applications", json=application_payload(case["inn"]))
    assert response.status_code == 201
    initial = response.json()
    assert initial["status"] == "SUBMITTED"
    assert initial["decision"] is None
    application_id = initial["id"]
    detail = wait_for_status(client, application_id, case["expected"]["status"])
    expected = case["expected"]
    assert detail["score"] == expected["score"]
    assert detail["decision"]["amount"] == expected["amount"]
    assert detail["decision"]["monthly_payment"] == expected["monthly_payment"]
    assert detail["decision"]["overpayment"] == expected["overpayment"]
    assert [Decimal(f["points"]) for f in detail["factors"]] == [
        Decimal(p) for p in expected["factor_points"]
    ]
    assert all(stage["state"] == "completed" for stage in detail["stages"])
    assert all(stage["finished_at"].endswith("Z") for stage in detail["stages"])
    assert [e["to_status"] for e in detail["events"]] == [
        "DRAFT",
        "SUBMITTED",
        "CHECKING_EGRUL",
        "CHECKING_BKI",
        "SCORING",
        expected["status"],
    ]
    if detail["status"] == "REJECTED":
        assert detail["rejection_reason"] == expected["rejection_reason"]
        assert len(detail["recommendations"]) in (2, 3)
        assert detail["reapply_date"] == three_months_later(datetime.now(UTC).date()).isoformat()
        assert client.post(f"/api/applications/{application_id}/accept-offer").status_code == 409
        assert (
            client.post(
                f"/api/applications/{application_id}/sign", json={"code": "1234"}
            ).status_code
            == 409
        )
        return
    assert Decimal(detail["decision"]["annual_rate"]) == Decimal(expected["rate"])
    if detail["status"] == "COUNTER_OFFER":
        assert (
            client.post(
                f"/api/applications/{application_id}/sign", json={"code": "1234"}
            ).status_code
            == 409
        )
        accepted = client.post(f"/api/applications/{application_id}/accept-offer")
        assert accepted.json()["status"] == "OFFER_ACCEPTED"
    wrong = client.post(f"/api/applications/{application_id}/sign", json={"code": "0000"})
    assert wrong.status_code == 400
    assert wrong.json()["code"] == "INVALID_SIGN_CODE"
    signed = client.post(f"/api/applications/{application_id}/sign", json={"code": "1234"})
    assert signed.status_code == 200
    assert signed.json()["status"] == "SIGNED"
    final = wait_for_status(client, application_id, "DISBURSED")
    assert final["decision"] == detail["decision"]
    assert final["events"][-2]["actor"] == "client"
    assert final["events"][-1]["actor"] == "system"
    assert (
        client.post(f"/api/applications/{application_id}/sign", json={"code": "1234"}).status_code
        == 409
    )


def test_idempotency_and_history(client):
    payload = application_payload()
    headers = {"Idempotency-Key": "demo-create-1"}
    first = client.post("/api/applications", json=payload, headers=headers)
    assert first.status_code == 201
    duplicate = client.post("/api/applications", json=payload, headers=headers)
    assert duplicate.status_code == 200
    assert duplicate.json()["id"] == first.json()["id"]
    conflict = client.post("/api/applications", json=payload | {"term_months": 12}, headers=headers)
    assert conflict.status_code == 409
    assert conflict.json()["code"] == "IDEMPOTENCY_CONFLICT"
    history = client.get("/api/applications").json()
    assert len(history) == 1
    assert history[0]["id"] == first.json()["id"]
    second = client.post("/api/applications", json=payload)
    assert second.status_code == 201
    assert second.json()["id"] != first.json()["id"]
    assert len(client.get("/api/applications?limit=1").json()) == 1
    assert client.get("/api/applications?offset=2").json() == []


def test_sign_attempt_limit(client):
    response = client.post("/api/applications", json=application_payload())
    application_id = response.json()["id"]
    wait_for_status(client, application_id, "APPROVED")
    for remaining in range(4, -1, -1):
        wrong = client.post(f"/api/applications/{application_id}/sign", json={"code": "0000"})
        assert wrong.status_code == 400
        assert wrong.json()["details"]["attempts_remaining"] == remaining
    blocked = client.post(f"/api/applications/{application_id}/sign", json={"code": "1234"})
    assert blocked.status_code == 429
    assert blocked.json()["code"] == "SIGN_ATTEMPTS_EXCEEDED"
    assert client.get(f"/api/applications/{application_id}").json()["status"] == "APPROVED"


@pytest.mark.parametrize("segment", ["retail", "services", "production", "general"])
def test_feed_segments_and_rejected_priority(client, segment):
    articles = client.get(f"/api/feed?segment={segment}").json()
    assert len(articles) == 4
    assert all(a["segment"] == segment and a["synthetic"] for a in articles)
    assert all(a["full_text"] and a["summary"] and a["reading_minutes"] > 0 for a in articles)
    prioritized = client.get(f"/api/feed?segment={segment}&context=rejected").json()
    assert [a["tag"] for a in prioritized[:2]] == ["Долговая нагрузка", "Кредитная история"]


def test_lookup_and_health(client):
    assert client.get("/api/health").json() == {"status": "ok", "database": "ok", "synthetic": True}
    profiles = client.get("/api/demo-profiles").json()
    assert len(profiles) == 3
    for profile in profiles:
        lookup = client.get("/api/companies/lookup", params={"inn": profile["inn"]}).json()
        assert lookup["found"] is True
        assert lookup["company"] == profile
    unknown = client.get("/api/companies/lookup?inn=0000000000")
    assert unknown.status_code == 200
    assert unknown.json()["found"] is False
    assert unknown.json()["company"] is None
    refused = client.post("/api/applications", json=application_payload("0000000000"))
    assert refused.status_code == 404
    assert refused.json()["code"] == "COMPANY_NOT_FOUND"
