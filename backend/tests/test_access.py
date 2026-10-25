from datetime import UTC, datetime, timedelta

from conftest import application_payload, login_as, make_settings, wait_for_status
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.passwords import token_hash
from app.db.access_models import LoginSession, User
from app.main import create_app


def test_anonymous_client_cannot_read_or_submit(client):
    client.headers.pop("Authorization")
    assert client.get("/api/applications").status_code == 401
    assert client.post("/api/applications", json=application_payload()).status_code == 401
    assert client.get("/api/auth/me").status_code == 401


def test_company_isolation_and_accountant_permissions(client):
    login_as(client, "retail-owner")
    first = client.post("/api/applications", json=application_payload()).json()
    wait_for_status(client, first["id"], "APPROVED")
    login_as(client, "services-owner")
    assert client.get("/api/applications").json() == []
    assert client.get(f"/api/applications/{first['id']}").status_code == 404
    assert (
        client.post(f"/api/applications/{first['id']}/sign", json={"code": "1234"}).status_code
        == 404
    )
    assert client.post("/api/applications", json=application_payload()).status_code == 404
    second = client.post("/api/applications", json=application_payload("500100732259")).json()
    wait_for_status(client, second["id"], "COUNTER_OFFER")
    login_as(client, "accountant")
    assert [a["id"] for a in client.get("/api/applications").json()] == [first["id"]]
    assert client.get(f"/api/applications/{first['id']}").status_code == 200
    for action, body in [("sign", {"code": "1234"}), ("accept-offer", None), ("retry", None)]:
        response = client.post(f"/api/applications/{first['id']}/{action}", json=body)
        assert response.status_code == 403
        assert response.json()["code"] == "FORBIDDEN"
    assert client.post("/api/applications", json=application_payload()).status_code == 403
    assert client.get("/api/bank/applications").status_code == 403
    assert client.post("/api/demo/reset").status_code == 403


def test_bank_session_and_identified_audit(client):
    created = client.post("/api/applications", json=application_payload("500100732259")).json()
    wait_for_status(client, created["id"], "COUNTER_OFFER")
    login_as(client, "underwriter")
    assert client.get("/api/applications").status_code == 403
    assert client.post("/api/applications", json=application_payload()).status_code == 403
    assert client.get("/api/bank/applications").json()[0]["id"] == created["id"]
    assert client.get(f"/api/bank/applications/{created['id']}").status_code == 200
    response = client.post(
        f"/api/bank/applications/{created['id']}/decision",
        json={"action": "approve", "comment": "Проверено сотрудником"},
    )
    assert response.status_code == 200
    assert response.json()["events"][-1]["details"]["reviewer"] == "underwriter"
    login_as(client)
    assert (
        client.get(f"/api/applications/{created['id']}").json()["decision"]["decided_by"] == "bank"
    )


def test_tokens_are_hashed_expire_and_logout_revokes(client):
    result = login_as(client)
    token = result["access_token"]
    with client.app.state.session_factory() as session:
        saved = session.get(LoginSession, token_hash(token))
        assert saved is not None
        assert saved.token_hash != token
        assert session.get(User, "director").password_hash.startswith("pbkdf2_sha256$")
        saved.expires_at = datetime.now(UTC) - timedelta(seconds=1)
        session.commit()
    assert client.get("/api/auth/me").status_code == 401
    login_as(client)
    assert client.post("/api/auth/logout").status_code == 200
    assert client.get("/api/auth/me").status_code == 401


def test_login_limit_and_no_password_in_response(client):
    accounts = client.get("/api/auth/demo-accounts").json()
    assert len(accounts) == 6
    assert all("password" not in account for account in accounts)
    for _ in range(10):
        assert (
            client.post(
                "/api/auth/login", json={"login": "director", "password": "wrong"}
            ).status_code
            == 401
        )
    assert (
        client.post("/api/auth/login", json={"login": "director", "password": "wrong"}).status_code
        == 429
    )


def test_sessions_survive_restart(tmp_path):
    settings = make_settings(tmp_path)
    with TestClient(create_app(settings)) as client:
        token = login_as(client)["access_token"]
    with TestClient(create_app(settings)) as client:
        client.headers["Authorization"] = f"Bearer {token}"
        assert client.get("/api/auth/me").json()["login"] == "director"


def test_demo_false_has_no_seed_accounts(tmp_path):
    app = create_app(make_settings(tmp_path, demo_mode=False))
    with TestClient(app) as client:
        assert client.get("/api/auth/demo-accounts").status_code == 404
        assert client.get("/api/demo-profiles").status_code == 404
        assert (
            client.post(
                "/api/auth/login", json={"login": "director", "password": "demo-credit-2026"}
            ).status_code
            == 401
        )
        with app.state.session_factory() as session:
            assert list(session.scalars(select(User))) == []


def test_idempotency_keys_are_scoped_to_user(client):
    headers = {"Idempotency-Key": "shared-key"}
    first = client.post("/api/applications", json=application_payload(), headers=headers).json()
    login_as(client, "retail-owner")
    second = client.post("/api/applications", json=application_payload(), headers=headers)
    assert second.status_code == 201
    assert second.json()["id"] != first["id"]


def test_disabling_demo_invalidates_existing_demo_access(tmp_path):
    with TestClient(create_app(make_settings(tmp_path))) as client:
        token = login_as(client)["access_token"]
    with TestClient(create_app(make_settings(tmp_path, demo_mode=False))) as client:
        client.headers["Authorization"] = f"Bearer {token}"
        assert client.get("/api/auth/me").status_code == 401
        assert (
            client.get(
                "/api/bank/applications", headers={"X-Bank-Token": "demo-bank-token"}
            ).status_code
            == 401
        )
        response = client.post(
            "/api/auth/login", json={"login": "director", "password": "demo-credit-2026"}
        )
        assert response.status_code == 401
