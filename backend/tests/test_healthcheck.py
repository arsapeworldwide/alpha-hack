from io import BytesIO
from urllib.error import URLError

import pytest

from app import healthcheck


@pytest.mark.parametrize(
    "body,status,healthy",
    [
        (b'{"status":"ok"}', 200, True),
        (b'{"status":"error"}', 200, False),
        (b'{"status":"ok"}', 503, False),
        (b"not-json", 200, False),
    ],
)
def test_healthcheck_exit_code(monkeypatch, body, status, healthy):
    response = BytesIO(body)
    response.status = status
    monkeypatch.setattr(healthcheck, "urlopen", lambda *_args, **_kwargs: response)
    if healthy:
        healthcheck.main()
    else:
        with pytest.raises(SystemExit) as result:
            healthcheck.main()
        assert result.value.code == 1


def test_healthcheck_connection_failure(monkeypatch):
    def unavailable(*_args, **_kwargs):
        raise URLError("Connection refused")

    monkeypatch.setattr(healthcheck, "urlopen", unavailable)
    with pytest.raises(SystemExit) as result:
        healthcheck.main()
    assert result.value.code == 1
