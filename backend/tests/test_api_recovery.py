import pytest
from conftest import application_payload, make_settings, wait_for_status
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.db.models import Application, ApplicationEvent, Company, FeedArticle, ScoringFactor
from app.main import create_app
from app.services.pipeline_steps import advance_pipeline


def test_bki_failure_and_recovery_after_restart(tmp_path):
    app = create_app(make_settings(tmp_path, simulate_bki_failure=True))
    with TestClient(app) as client:
        application_id = client.post("/api/applications", json=application_payload()).json()["id"]
        detail = wait_for_status(client, application_id, "NEEDS_RECHECK")
        assert detail["message"]
        assert detail["rejection_reason"] is None
        assert detail["stages"][2]["state"] == "failed"
        assert detail["events"][-1]["details"]["code"] == "BKI_UNAVAILABLE"
    with TestClient(create_app(make_settings(tmp_path))) as client:
        detail = wait_for_status(client, application_id, "APPROVED")
        assert detail["score"] == 97
        assert detail["stages"][2]["state"] == "completed"
        assert len(detail["factors"]) == 5
        assert [e["to_status"] for e in detail["events"]].count("CHECKING_BKI") == 2


@pytest.mark.parametrize("stuck", ["SUBMITTED", "CHECKING_EGRUL", "CHECKING_BKI", "SCORING"])
def test_interrupted_pipeline_resumes_without_duplicate_steps(tmp_path, stuck):
    app = create_app(make_settings(tmp_path, pipeline_step_seconds=60))
    with TestClient(app) as client:
        application_id = client.post("/api/applications", json=application_payload()).json()["id"]
        with app.state.session_factory() as session:
            application = session.get(Application, application_id)
            while application.status != stuck:
                advance_pipeline(
                    session, application, app.state.pipeline.egrul, app.state.pipeline.bki
                )
    with TestClient(create_app(make_settings(tmp_path))) as client:
        detail = wait_for_status(client, application_id, "APPROVED")
        statuses = [e["to_status"] for e in detail["events"]]
        assert statuses == [
            "DRAFT",
            "SUBMITTED",
            "CHECKING_EGRUL",
            "CHECKING_BKI",
            "SCORING",
            "APPROVED",
        ]
        assert len(detail["factors"]) == 5


def test_signed_application_is_disbursed_after_restart(tmp_path):
    app = create_app(make_settings(tmp_path, pipeline_step_seconds=60))
    with TestClient(app) as client:
        application_id = client.post("/api/applications", json=application_payload()).json()["id"]
        with app.state.session_factory() as session:
            application = session.get(Application, application_id)
            while application.status != "APPROVED":
                advance_pipeline(
                    session, application, app.state.pipeline.egrul, app.state.pipeline.bki
                )
        assert (
            client.post(f"/api/applications/{application_id}/sign", json={"code": "1234"}).json()[
                "status"
            ]
            == "SIGNED"
        )
    with TestClient(create_app(make_settings(tmp_path))) as client:
        detail = wait_for_status(client, application_id, "DISBURSED")
        assert [e["to_status"] for e in detail["events"]].count("SIGNED") == 1
        assert [e["to_status"] for e in detail["events"]].count("DISBURSED") == 1


def test_reset_cancels_inflight_tasks_and_preserves_seed(tmp_path):
    app = create_app(make_settings(tmp_path, pipeline_step_seconds=60))
    with TestClient(app) as client:
        for _ in range(2):
            assert client.post("/api/applications", json=application_payload()).status_code == 201
        reset = client.post("/api/demo/reset")
        assert reset.status_code == 200
        assert reset.json()["deleted_applications"] == 2
        assert client.get("/api/applications").json() == []
        assert not app.state.pipeline.tasks
        with app.state.session_factory() as session:
            for model in (Application, ApplicationEvent, ScoringFactor):
                assert session.scalar(select(func.count()).select_from(model)) == 0
            assert session.scalar(select(func.count()).select_from(Company)) == 3
            assert session.scalar(select(func.count()).select_from(FeedArticle)) == 16
    with TestClient(create_app(make_settings(tmp_path))) as client:
        assert client.get("/api/applications").json() == []


def test_idempotency_and_sign_limit_survive_restart(tmp_path):
    payload = application_payload()
    headers = {"Idempotency-Key": "persistent-key"}
    with TestClient(create_app(make_settings(tmp_path))) as client:
        application_id = client.post("/api/applications", json=payload, headers=headers).json()[
            "id"
        ]
        wait_for_status(client, application_id, "APPROVED")
        for _ in range(5):
            assert (
                client.post(
                    f"/api/applications/{application_id}/sign", json={"code": "0000"}
                ).status_code
                == 400
            )
    with TestClient(create_app(make_settings(tmp_path))) as client:
        duplicate = client.post("/api/applications", json=payload, headers=headers)
        assert duplicate.status_code == 200
        assert duplicate.json()["id"] == application_id
        assert (
            client.post(
                f"/api/applications/{application_id}/sign", json={"code": "1234"}
            ).status_code
            == 429
        )
