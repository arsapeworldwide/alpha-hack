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
    assert detail["decision"]["score"] == expected["score"]
    assert detail["decision"]["approved_amount"] == expected["amount"]
    assert detail["decision"]["monthly_payment"] == expected["monthly_payment"]
    assert detail["decision"]["overpayment"] == expected["overpayment"]
    assert [Decimal(str(f["points"])) for f in detail["decision"]["factors"]] == [
        Decimal(p) for p in expected["factor_points"]
    ]
    assert all(stage["state"] == "done" for stage in detail["pipeline"])
    assert all(stage["finished_at"].endswith("Z") for stage in detail["pipeline"])
    assert [e["to_status"] for e in detail["events"]] == [
        "DRAFT",
        "SUBMITTED",
        "CHECKING_EGRUL",
        "CHECKING_BKI",
        "SCORING",
        expected["status"],
    ]
    if detail["status"] == "REJECTED":
        assert detail["decision"]["rejection_reason"] == expected["rejection_reason"]
        assert len(detail["decision"]["recommendations"]) in (2, 3)
        assert (
            detail["decision"]["reapply_date"]
            == three_months_later(datetime.now(UTC).date()).isoformat()
        )
        assert client.post(f"/api/applications/{application_id}/accept-offer").status_code == 409
        assert (
            client.post(
                f"/api/applications/{application_id}/sign", json={"code": "1234"}
            ).status_code
            == 409
        )
        return
    assert Decimal(detail["decision"]["rate"]) == Decimal(expected["rate"])
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
    assert conflict.json()["code"] == "INVALID_TRANSITION"
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
        assert wrong.status_code == (429 if remaining == 0 else 400)
        assert wrong.json()["details"]["attempts_left"] == remaining
    blocked = client.post(f"/api/applications/{application_id}/sign", json={"code": "1234"})
    assert blocked.status_code == 429
    assert blocked.json()["code"] == "TOO_MANY_ATTEMPTS"
    assert client.get(f"/api/applications/{application_id}").json()["status"] == "APPROVED"


@pytest.mark.parametrize("segment", ["retail", "services", "production", "general"])
def test_feed_segments_and_rejected_priority(client, segment):
    response = client.get(f"/api/feed?segment={segment}").json()
    assert response["segment"] == segment
    assert response["reason"]
    articles = response["items"]
    assert len(articles) == (4 if segment == "general" else 5)
    assert all(a["synthetic"] for a in articles)
    assert all(a["body"] and a["summary"] and a["read_minutes"] > 0 for a in articles)
    # В обычной ленте нет советов после отказа, а статьи у сегментов разные
    assert all(a["tag"] != "Повысить шансы" for a in articles)
    others = {
        a["title"]
        for s in ("retail", "services", "production", "general")
        if s != segment
        for a in client.get(f"/api/feed?segment={s}").json()["items"]
    }
    assert not {a["title"] for a in articles} & others
    prioritized = client.get(f"/api/feed?segment={segment}&context=rejected").json()
    assert len(prioritized["items"]) == 5
    assert [a["tag"] for a in prioritized["items"][:3]] == ["Повысить шансы"] * 3
    assert "долговую нагрузку" in prioritized["items"][0]["title"]


def test_lookup_and_health(client):
    assert client.get("/api/health").json() == {"status": "ok", "database": "ok", "synthetic": True}
    profiles = client.get("/api/demo-profiles").json()
    assert len(profiles) == 3
    for profile in profiles:
        lookup = client.get(
            "/api/companies/lookup", params={"inn": profile["company"]["inn"]}
        ).json()
        assert lookup == profile["company"]
    unknown = client.get("/api/companies/lookup?inn=0000000000")
    assert unknown.status_code == 404
    assert unknown.json()["code"] == "COMPANY_NOT_FOUND"
    refused = client.post("/api/applications", json=application_payload("0000000000"))
    assert refused.status_code == 404
    assert refused.json()["code"] == "COMPANY_NOT_FOUND"
