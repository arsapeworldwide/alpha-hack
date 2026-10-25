import json
from pathlib import Path
from time import monotonic, sleep

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


def load_scoring_cases() -> dict:
    path = Path(__file__).resolve().parents[2] / "docs" / "scoring_cases.json"
    return json.loads(path.read_text(encoding="utf-8"))


@pytest.fixture
def cases() -> dict:
    return load_scoring_cases()


def make_settings(tmp_path: Path, **overrides) -> Settings:
    return Settings(
        _env_file=None,
        **(
            {
                "database_url": f"sqlite:///{(tmp_path / 'api.db').as_posix()}",
                "pipeline_step_seconds": 0,
                "log_level": "ERROR",
            }
            | overrides
        ),
    )


@pytest.fixture
def client(tmp_path):
    with TestClient(create_app(make_settings(tmp_path)), raise_server_exceptions=False) as client:
        yield client


def application_payload(inn: str = "7712345678", **changes) -> dict:
    from app.db.seed_data import COMPANIES

    company = dict(next((c for c in COMPANIES if c["inn"] == inn), COMPANIES[0]))
    company["inn"] = inn
    return {
        "company": company,
        "requested_amount": 10_000_000,
        "term_months": 36,
        "goal": "working_capital",
    } | changes


def wait_for_status(client: TestClient, application_id: str, status: str) -> dict:
    deadline = monotonic() + 3
    while monotonic() < deadline:
        response = client.get(f"/api/applications/{application_id}")
        assert response.status_code == 200, response.text
        detail = response.json()
        if detail["status"] == status:
            return detail
        sleep(0.005)
    raise AssertionError(f"Expected {status}, got {detail['status']}")
