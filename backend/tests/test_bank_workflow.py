from decimal import Decimal

from conftest import application_payload, make_settings, wait_for_status
from fastapi.testclient import TestClient

from app.db.models import Company
from app.main import create_app

BANK_HEADERS = {"X-Bank-Token": "demo-bank-token"}


def review(client, application_id, action, comment="Ручное демо-решение"):
    return client.post(
        f"/api/bank/applications/{application_id}/decision",
        json={"action": action, "comment": comment},
        headers=BANK_HEADERS,
    )


def test_bank_approves_original_counter_request_and_client_signs(client):
    created = client.post("/api/applications", json=application_payload("500100732259")).json()
    original = wait_for_status(client, created["id"], "COUNTER_OFFER")
    queue = client.get("/api/bank/applications", headers=BANK_HEADERS).json()
    assert queue[0]["id"] == created["id"]
    assert queue[0]["decision"]["factors"] == original["decision"]["factors"]
    approved = review(client, created["id"], "approve", "  Подтверждены дополнительные данные  ")
    assert approved.status_code == 200
    detail = approved.json()
    assert detail["status"] == "APPROVED"
    assert detail["decision"]["score"] == 46
    assert detail["decision"]["factors"] == original["decision"]["factors"]
    assert (detail["decision"]["decided_by"] == "bank") is True
    assert detail["decision"]["approved_amount"] == 10_000_000
    assert Decimal(detail["decision"]["rate"]) == 24
    assert detail["decision"]["monthly_payment"] == 392_329
    assert detail["decision"]["overpayment"] == 4_123_844
    audit = detail["events"][-1]
    assert audit["actor"] == "bank"
    assert audit["details"]["comment"] == "Подтверждены дополнительные данные"
    assert audit["details"]["previous_decision"]["amount"] == 2_500_000
    signed = client.post(f"/api/applications/{created['id']}/sign", json={"code": "1234"})
    assert signed.status_code == 200
    wait_for_status(client, created["id"], "DISBURSED")
    assert review(client, created["id"], "reject").status_code == 409
    assert client.get("/api/bank/applications", headers=BANK_HEADERS).json() == []


def test_bank_rejects_automatic_approval_and_can_reconsider(client):
    created = client.post("/api/applications", json=application_payload()).json()
    original = wait_for_status(client, created["id"], "APPROVED")
    rejected = review(client, created["id"], "reject")
    assert rejected.status_code == 200
    detail = rejected.json()
    assert detail["status"] == "REJECTED"
    assert (detail["decision"]["decided_by"] == "bank") is True
    assert detail["decision"]["approved_amount"] is None
    assert detail["decision"]["score"] == original["decision"]["score"]
    assert detail["decision"]["factors"] == original["decision"]["factors"]
    assert len(detail["decision"]["recommendations"]) == 2
    assert detail["decision"]["reapply_date"]
    assert "ручного" in detail["decision"]["rejection_reason"]
    assert (
        client.post(f"/api/applications/{created['id']}/sign", json={"code": "1234"}).status_code
        == 409
    )
    restored = review(client, created["id"], "approve").json()
    assert restored["status"] == "APPROVED"
    assert restored["decision"]["rejection_reason"] is None
    assert restored["decision"]["recommendations"] == []
    assert restored["decision"]["reapply_date"] is None


def test_bank_cannot_invent_a_rate_below_score_45(client):
    created = client.post("/api/applications", json=application_payload("7723456789")).json()
    original = wait_for_status(client, created["id"], "REJECTED")
    refused = review(client, created["id"], "approve")
    assert refused.status_code == 409
    assert refused.json()["code"] == "INVALID_TRANSITION"
    saved = client.get(f"/api/applications/{created['id']}").json()
    assert saved == original


def test_bank_can_override_capacity_rejection_with_defined_rate(client):
    with client.app.state.session_factory() as session:
        company = session.get(Company, "7712345678")
        company.annual_revenue = 24_000_000
        company.monthly_payments = 500_000
        company.business_age_years = 5
        session.commit()
    created = client.post(
        "/api/applications", json=application_payload(requested_amount=1_000_000)
    ).json()
    original = wait_for_status(client, created["id"], "REJECTED")
    assert original["decision"]["score"] == 62
    approved = review(client, created["id"], "approve").json()
    assert approved["status"] == "APPROVED"
    assert Decimal(approved["decision"]["rate"]) == Decimal("21.5")
    assert approved["decision"]["approved_amount"] == 1_000_000


def test_bank_confirmation_is_audited_and_accepted_offer_is_locked(client):
    created = client.post("/api/applications", json=application_payload()).json()
    wait_for_status(client, created["id"], "APPROVED")
    first = review(client, created["id"], "approve").json()
    second = review(client, created["id"], "approve").json()
    assert len(second["events"]) == len(first["events"]) + 1
    assert second["events"][-1]["from_status"] == "APPROVED"
    assert second["events"][-1]["to_status"] == "APPROVED"
    counter = client.post("/api/applications", json=application_payload("500100732259")).json()
    wait_for_status(client, counter["id"], "COUNTER_OFFER")
    assert client.post(f"/api/applications/{counter['id']}/accept-offer").status_code == 200
    assert review(client, counter["id"], "reject").status_code == 409


def test_recheck_requires_scoring_and_manual_rejection_survives_restart(tmp_path):
    app = create_app(make_settings(tmp_path, simulate_bki_failure=True))
    with TestClient(app) as client:
        created = client.post("/api/applications", json=application_payload()).json()
        wait_for_status(client, created["id"], "NEEDS_RECHECK")
        refused = review(client, created["id"], "approve")
        assert refused.status_code == 409
        assert refused.json()["code"] == "INVALID_TRANSITION"
        rejected = review(client, created["id"], "reject").json()
        assert rejected["status"] == "REJECTED"
        assert (rejected["decision"]["decided_by"] == "bank") is True
    with TestClient(create_app(make_settings(tmp_path))) as client:
        saved = client.get(f"/api/applications/{created['id']}").json()
        assert saved == rejected
