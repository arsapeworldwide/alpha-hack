from uuid import uuid4

import pytest
from conftest import application_payload, make_settings
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.mark.parametrize("headers", [{}, {"X-Bank-Token": "wrong"}])
def test_bank_routes_require_token(client, headers):
    queue = client.get("/api/bank/applications", headers=headers)
    decision = client.post(
        f"/api/bank/applications/{uuid4()}/decision",
        json={"action": "reject", "comment": "Демо"},
        headers=headers,
    )
    for response in (queue, decision):
        assert response.status_code == 401
        assert response.json()["code"] == "UNAUTHORIZED"
        assert response.headers["x-request-id"]


def test_custom_token_replaces_default(tmp_path):
    app = create_app(make_settings(tmp_path, bank_api_token="custom-test-bank-token"))
    with TestClient(app) as client:
        assert (
            client.get(
                "/api/bank/applications", headers={"X-Bank-Token": "demo-bank-token"}
            ).status_code
            == 401
        )
        accepted = client.get(
            "/api/bank/applications", headers={"X-Bank-Token": "custom-test-bank-token"}
        )
        assert accepted.status_code == 200
        assert accepted.json() == []


@pytest.mark.parametrize(
    "changes",
    [
        {"action": "counter"},
        {"comment": 123},
        {"comment": "a" * 501},
        {"amount": 1000000},
    ],
)
def test_bank_input_validation(client, changes):
    response = client.post(
        f"/api/bank/applications/{uuid4()}/decision",
        json={"action": "approve", "comment": "Демо"} | changes,
        headers={"X-Bank-Token": "demo-bank-token"},
    )
    assert response.status_code == 422
    assert response.json()["code"] == "VALIDATION_ERROR"


def test_bank_token_and_comment_are_not_logged(client, monkeypatch):
    from app.core.logging import logger

    records = []
    monkeypatch.setattr(logger, "info", lambda event, extra: records.append((event, extra)))
    client.post(
        f"/api/bank/applications/{uuid4()}/decision",
        json={"action": "reject", "comment": "private-comment"},
        headers={"X-Bank-Token": "demo-bank-token"},
    )
    assert records
    assert "private-comment" not in str(records)
    assert "demo-bank-token" not in str(records)


def test_bank_cannot_intervene_during_pipeline(tmp_path):
    app = create_app(make_settings(tmp_path, pipeline_step_seconds=60))
    with TestClient(app) as client:
        created = client.post("/api/applications", json=application_payload()).json()
        response = client.post(
            f"/api/bank/applications/{created['id']}/decision",
            json={"action": "approve", "comment": "Рано"},
            headers={"X-Bank-Token": "demo-bank-token"},
        )
        assert response.status_code == 409
        assert response.json()["code"] == "INVALID_TRANSITION"
        assert (
            client.get("/api/bank/applications", headers={"X-Bank-Token": "demo-bank-token"}).json()
            == []
        )
