import json
from pathlib import Path

import pytest


def load_scoring_cases() -> dict:
    path = Path(__file__).resolve().parents[2] / "docs" / "scoring_cases.json"
    return json.loads(path.read_text(encoding="utf-8"))


@pytest.fixture
def cases() -> dict:
    return load_scoring_cases()
