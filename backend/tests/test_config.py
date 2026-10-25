import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import func, select

from app.core.config import Settings
from app.db.models import Company
from app.main import create_app


def test_config_from_environment(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "sqlite:///:memory:")
    monkeypatch.setenv("SIMULATE_BKI_FAILURE", "true")
    monkeypatch.setenv("PIPELINE_STEP_SECONDS", "0")
    monkeypatch.setenv("BANK_API_TOKEN", "test-private-bank-token")
    settings = Settings(_env_file=None)
    assert settings.simulate_bki_failure is True
    assert settings.pipeline_step_seconds == 0
    assert settings.database_url == "sqlite:///:memory:"
    assert "test-private-bank-token" not in repr(settings)


def test_negative_pipeline_delay_is_invalid():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, pipeline_step_seconds=-1)


def test_app_startup_creates_seed_and_serves_swagger(tmp_path):
    settings = Settings(
        _env_file=None, database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}"
    )
    app = create_app(settings)
    with TestClient(app) as client:
        assert client.get("/api/docs").status_code == 200
        assert client.get("/api/openapi.json").json()["info"]["version"] == "1.0.0"
        with app.state.session_factory() as session:
            assert session.scalar(select(func.count()).select_from(Company)) == 5
        response = client.options(
            "/api/applications",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "POST",
            },
        )
        assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
        denied = client.options(
            "/api/applications",
            headers={
                "Origin": "https://unknown.example",
                "Access-Control-Request-Method": "POST",
            },
        )
        assert "access-control-allow-origin" not in denied.headers
