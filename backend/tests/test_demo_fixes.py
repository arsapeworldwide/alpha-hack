import hashlib
from pathlib import Path

import pytest
from conftest import application_payload, login_as, wait_for_status


def create(client, inn="500100732259", **changes):
    result = client.post("/api/applications", json=application_payload(inn, **changes))
    assert result.status_code == 201, result.text
    return result.json()["id"]


def review(client, application_id, **payload):
    return client.post(
        f"/api/bank/applications/{application_id}/decision",
        json=payload,
        headers={"X-Bank-Token": "demo-bank-token"},
    )


def test_consent_required_before_bki_and_catalog(client):
    public = client.get("/api/companies/lookup?inn=7712345678").json()
    assert "credit_history" not in public
    assert "monthly_payments" not in public
    payload = application_payload()
    del payload["consent"]
    assert client.post("/api/applications", json=payload).status_code == 422
    payload["consent"] = False
    assert client.post("/api/applications", json=payload).status_code == 422
    assert len(client.get("/api/products").json()) == 3
    payload.update(consent=True, product_code="OVERDRAFT")
    assert client.post("/api/applications", json=payload).status_code == 422
    assert client.get("/api/applications").json() == []


def test_counter_custom_term_and_override_justification(client):
    application_id = create(client)
    wait_for_status(client, application_id, "COUNTER_OFFER")
    assert review(client, application_id, action="approve").status_code == 422
    counter = review(client, application_id, action="counter", amount=1_000_000, term_months=24)
    assert counter.status_code == 200, counter.text
    assert counter.json()["decision"]["term_months"] == 24
    assert counter.json()["requested_amount"] == 10_000_000
    assert counter.json()["term_months"] == 36
    assert counter.json()["decision"]["score"] == 46
    assert counter.json()["system_recommendation"]["amount"] == 2_500_000
    assert (
        client.post(f"/api/applications/{application_id}/sign", json={"code": "1234"}).status_code
        == 409
    )
    client.post(f"/api/applications/{application_id}/accept-offer")
    signed = client.post(f"/api/applications/{application_id}/sign", json={"code": "1234"})
    assert signed.status_code == 200
    assert signed.json()["decision"]["term_months"] == 24
    assert (
        signed.json()["decision"]["total_payment"]
        == signed.json()["decision"]["monthly_payment"] * 24
    )


def test_queue_modes_and_manual_review_before_client_decision(client):
    approved_id = create(client, "7712345678")
    wait_for_status(client, approved_id, "APPROVED")
    assert (
        client.get(
            "/api/bank/applications?view=needs_decision",
            headers={"X-Bank-Token": "demo-bank-token"},
        ).json()
        == []
    )
    assert (
        client.get(
            "/api/bank/applications?view=all", headers={"X-Bank-Token": "demo-bank-token"}
        ).json()[0]["id"]
        == approved_id
    )
    manual_id = create(
        client, "7734567890", goal="equipment", requested_amount=8_000_000, product_code="INVEST"
    )
    manual = wait_for_status(client, manual_id, "MANUAL_REVIEW")
    assert manual["decision"] is None
    bank = client.get(
        f"/api/bank/applications/{manual_id}", headers={"X-Bank-Token": "demo-bank-token"}
    ).json()
    assert bank["system_recommendation"]["outcome"] == "APPROVED"
    assert bank["system_recommendation"]["factors"]
    assert (
        review(client, manual_id, action="approve", comment="Проверено специалистом").status_code
        == 200
    )
    assert client.get(f"/api/applications/{manual_id}").json()["status"] == "APPROVED"


def test_document_recheck_does_not_reuse_previous_manual_term(client):
    application_id = create(client)
    wait_for_status(client, application_id, "COUNTER_OFFER")
    review(client, application_id, action="counter", amount=1_000_000, term_months=24)
    review(client, application_id, action="request_info", checklist=["Выписка"])
    response = client.post(
        f"/api/applications/{application_id}/documents",
        data={"kind": "Выписка", "consent": "true"},
        files={"file": ("test.pdf", b"%PDF-1.4\nSynthetic\n%%EOF", "application/pdf")},
    )
    assert response.status_code == 200
    detail = wait_for_status(client, application_id, "COUNTER_OFFER")
    assert detail["decision"]["term_months"] == 36
    assert detail["decision"]["monthly_payment"] == 98_082
    assert detail["decision"]["total_payment"] == 98_082 * 36


def test_document_upload_permissions_and_resumption(client):
    application_id = create(client, "7712345678")
    wait_for_status(client, application_id, "APPROVED")
    response = review(
        client,
        application_id,
        action="request_info",
        checklist=["Выписка", "Баланс"],
        comment="Уточните сведения",
    )
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "INFO_REQUESTED"
    login_as(client, "accountant")
    data = {"kind": "Выписка", "consent": "true"}
    pdf = b"%PDF-1.4\nSynthetic document\n%%EOF"
    assert (
        client.post(
            f"/api/applications/{application_id}/documents",
            data=data,
            files={"file": ("sample.pdf", pdf, "application/pdf")},
        ).status_code
        == 403
    )
    login_as(client)
    first = client.post(
        f"/api/applications/{application_id}/documents",
        data=data,
        files={"file": ("sample.pdf", pdf, "application/pdf")},
    )
    assert first.status_code == 200, first.text
    assert first.json()["status"] == "INFO_REQUESTED"
    doc_id = first.json()["requested_documents"][0]["document_id"]
    downloaded = client.get(f"/api/applications/{application_id}/documents/{doc_id}")
    assert downloaded.content == pdf
    assert downloaded.headers["x-content-type-options"] == "nosniff"
    login_as(client, "services-owner")
    assert client.get(f"/api/applications/{application_id}/documents/{doc_id}").status_code == 404
    login_as(client)
    data["kind"] = "Баланс"
    second = client.post(
        f"/api/applications/{application_id}/documents",
        data=data,
        files={"file": ("sample.pdf", pdf, "application/pdf")},
    )
    assert second.status_code == 200
    detail = wait_for_status(client, application_id, "APPROVED")
    assert detail["decision"]["score"] == 97
    assert detail["decision"]["term_months"] == 36
    assert any(
        e["from_status"] == "INFO_REQUESTED" and e["to_status"] == "CHECKING_EGRUL"
        for e in detail["events"]
    )
    from app.db.workflow_models import ApplicationDocument

    with client.app.state.session_factory() as session:
        doc = session.get(ApplicationDocument, doc_id)
        assert doc.sha256 == hashlib.sha256(pdf).hexdigest()
    client.post("/api/demo/reset")
    assert list(Path(client.app.state.settings.document_directory).glob("*")) == []


@pytest.mark.parametrize(
    "content,media,status",
    [
        (b"html", "text/html", 422),
        (b"wrong", "application/pdf", 422),
        (b"%PDF-" + b"x" * (10 * 1024 * 1024), "application/pdf", 413),
    ],
    ids=["html", "wrong-signature", "oversize"],
)
def test_document_rejects_wrong_type_and_oversize(client, content, media, status):
    application_id = create(client)
    wait_for_status(client, application_id, "COUNTER_OFFER")
    review(client, application_id, action="request_info", checklist=["Выписка"])
    response = client.post(
        f"/api/applications/{application_id}/documents",
        data={"kind": "Выписка", "consent": "true"},
        files={"file": ("file", content, media)},
    )
    assert response.status_code == status, response.text
