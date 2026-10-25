from conftest import (
    application_payload,
    authenticated_client,
    login_as,
    make_settings,
    wait_for_status,
)

from app.main import create_app


def test_bki_control_recovers_same_application_without_restart(client):
    assert client.post("/api/demo/failures", json={"bki": "down"}).status_code == 200
    created = client.post("/api/applications", json=application_payload()).json()
    wait_for_status(client, created["id"], "NEEDS_RECHECK")
    assert client.post("/api/demo/failures", json={"bki": "ok"}).status_code == 200
    assert client.post(f"/api/applications/{created['id']}/retry").status_code == 200
    detail = wait_for_status(client, created["id"], "APPROVED")
    assert detail["decision"]["score"] == 97
    assert len(detail["decision"]["factors"]) == 5
    assert [e["to_status"] for e in detail["events"]].count("CHECKING_BKI") == 2


def test_demo_reset_restores_source_and_permissions(client):
    login_as(client, "accountant")
    assert client.get("/api/demo/failures").status_code == 200
    assert client.post("/api/demo/failures", json={"bki": "down"}).status_code == 403
    login_as(client)
    client.post("/api/demo/failures", json={"bki": "down"})
    assert client.get("/api/demo/failures").json() == {"bki": "down"}
    client.post("/api/demo/reset")
    assert client.get("/api/demo/failures").json() == {"bki": "ok"}
    assert client.post("/api/demo/failures", json={"bki": "slow"}).status_code == 422


def test_demo_failure_survives_restart(tmp_path):
    with authenticated_client(create_app(make_settings(tmp_path))) as client:
        client.post("/api/demo/failures", json={"bki": "down"})
    with authenticated_client(create_app(make_settings(tmp_path))) as client:
        assert client.get("/api/demo/failures").json() == {"bki": "down"}
