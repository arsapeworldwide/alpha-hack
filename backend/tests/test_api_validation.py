import json
from uuid import uuid4

import pytest
from conftest import application_payload

from app.api import applications
from app.api.dependencies import get_session
from app.core.logging import JsonFormatter


@pytest.mark.parametrize(
    "changes",
    [
        {"inn": "123"},
        {"inn": 7712345678},
        {"inn": "١٢٣٤٥٦٧٨٩٠"},
        {"requested_amount": 299999},
        {"requested_amount": 15000001},
        {"requested_amount": 300000.0},
        {"requested_amount": "1000000"},
        {"requested_amount": True},
        {"term_months": 2},
        {"term_months": 37},
        {"goal": "cash_gap", "term_months": 13},
        {"annual_revenue": 1000000000},
        {"goal": "unrecognized"},
    ],
)
def test_invalid_application_inputs(client, changes):
    response = client.post("/api/applications", json=application_payload(**changes))
    assert response.status_code == 422
    assert set(response.json()) == {"code", "message", "details"}
    assert response.json()["code"] == "VALIDATION_ERROR"


@pytest.mark.parametrize(
    "path",
    [
        "/api/companies/lookup?inn=bad",
        "/api/feed?segment=bad",
        "/api/feed?context=bad",
        "/api/companies/lookup",
        "/api/applications?limit=101",
        "/api/applications?offset=-1",
    ],
)
def test_invalid_query_or_path(client, path):
    response = client.get(path)
    assert response.status_code == 422
    assert response.json()["details"]["fields"]


def test_clear_inn_error(client):
    assert "10 или 12 цифр" in client.get("/api/companies/lookup?inn=bad").json()["message"]


def test_missing_application_and_unknown_route(client):
    response = client.get(f"/api/applications/{uuid4()}")
    assert response.status_code == 404
    assert response.json()["code"] == "NOT_FOUND"
    assert client.get("/not-a-route").json()["code"] == "NOT_FOUND"
    assert client.put("/api/health").json()["code"] == "NOT_FOUND"


def test_request_id_and_redacted_validation(client):
    response = client.post(
        "/api/applications",
        content="{broken",
        headers={"Content-Type": "application/json", "X-Request-ID": "demo-123"},
    )
    assert response.status_code == 422
    assert response.headers["x-request-id"] == "demo-123"
    assert "{broken" not in response.text
    bad_id = client.get("/api/health", headers={"X-Request-ID": "too long " * 20})
    assert len(bad_id.headers["x-request-id"]) == 36


def test_unexpected_exception_is_masked(client, monkeypatch):
    def broken(*_args, **_kwargs):
        raise RuntimeError("private-data-must-not-leak")

    monkeypatch.setattr(applications, "create_application", broken)
    response = client.post(
        "/api/applications", json=application_payload(), headers={"Origin": "http://localhost:5173"}
    )
    assert response.status_code == 500
    assert response.json()["code"] == "INTERNAL_ERROR"
    assert "private-data" not in response.text
    assert response.headers["x-request-id"]
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_database_error_is_a_safe_503(client):
    from sqlalchemy.exc import SQLAlchemyError

    class UnavailableSession:
        def execute(self, _query):
            raise SQLAlchemyError("private-database-parameters")

    client.app.dependency_overrides[get_session] = lambda: UnavailableSession()
    response = client.get("/api/health")
    assert response.status_code == 503
    assert response.json()["code"] == "INTERNAL_ERROR"
    assert "private" not in response.text


def test_request_logs_do_not_include_inn_or_sign_code(client, monkeypatch):
    from app.core.logging import logger

    records = []
    monkeypatch.setattr(logger, "info", lambda event, extra: records.append((event, extra)))
    client.get("/api/companies/lookup?inn=7712345678")
    client.post(f"/api/applications/{uuid4()}/sign", json={"code": "9876"})
    serialized = json.dumps(records)
    assert "7712345678" not in serialized
    assert "9876" not in serialized
    assert "/api/companies/lookup" in serialized
    assert all(record[1]["request_id"] for record in records)


def test_json_log_has_no_request_payload():
    import logging

    record = logging.LogRecord("credit", logging.INFO, "", 0, "request_completed", (), None)
    record.request_id = "example"
    record.body = {"code": "1234", "inn": "7712345678"}
    payload = json.loads(JsonFormatter().format(record))
    assert payload["request_id"] == "example"
    assert "1234" not in json.dumps(payload)
    assert "7712345678" not in json.dumps(payload)
