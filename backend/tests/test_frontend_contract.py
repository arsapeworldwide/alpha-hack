from pathlib import Path

import pytest
import yaml
from conftest import application_payload, authenticated_client, wait_for_status
from jsonschema import Draft202012Validator

CONTRACT = yaml.safe_load(
    (Path(__file__).resolve().parents[2] / "docs/frontend/openapi.yaml").read_text(encoding="utf-8")
)


def validate(schema: str, value) -> None:
    Draft202012Validator(
        {"$ref": f"#/components/schemas/{schema}", "components": CONTRACT["components"]}
    ).validate(value)


def test_frontend_operations_exist(client):
    generated = client.get("/api/openapi.json").json()
    for path, operations in CONTRACT["paths"].items():
        for method in operations:
            assert method in generated["paths"]["/api" + path]


@pytest.mark.parametrize(
    "inn,status",
    [("7712345678", "APPROVED"), ("500100732259", "COUNTER_OFFER"), ("7723456789", "REJECTED")],
)
def test_real_responses_validate_against_original_frontend_contract(client, inn, status):
    for profile in client.get("/api/demo-profiles").json():
        assert "credit_history" not in profile["company"]
        assert "monthly_payments" not in profile["company"]
    registry = client.get("/api/companies/lookup", params={"inn": inn}).json()
    assert "credit_history" not in registry
    payload = application_payload(inn)
    validate("ApplicationCreate", payload)
    created = client.post("/api/applications", json=payload)
    validate("Application", created.json())
    detail = wait_for_status(client, created.json()["id"], status)
    validate("Application", detail)
    for entry in client.get("/api/applications").json():
        validate("ApplicationSummary", entry)
    validate("FeedResponse", client.get("/api/feed?segment=retail&context=default").json())
    validate("Error", client.get("/api/companies/lookup?inn=0000000000").json())
    validate("ResetResult", client.post("/api/demo/reset").json())


def test_retry_is_saved_and_recovers_without_restart(tmp_path):
    from conftest import make_settings

    from app.main import create_app

    app = create_app(make_settings(tmp_path, simulate_bki_failure=True))
    with authenticated_client(app) as client:
        created = client.post("/api/applications", json=application_payload()).json()
        wait_for_status(client, created["id"], "NEEDS_RECHECK")
        app.state.pipeline.bki.simulate_failure = False
        retried = client.post(f"/api/applications/{created['id']}/retry")
        assert retried.status_code == 200
        assert retried.json()["status"] == "CHECKING_BKI"
        detail = wait_for_status(client, created["id"], "APPROVED")
        validate("Application", detail)
        assert [e["to_status"] for e in detail["events"]].count("CHECKING_BKI") == 2
        assert client.post(f"/api/applications/{created['id']}/retry").status_code == 409
