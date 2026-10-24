from pathlib import Path

import yaml


def test_exported_contract_matches_fastapi(client):
    path = Path(__file__).resolve().parents[2] / "docs" / "openapi.yaml"
    contract = yaml.safe_load(path.read_text(encoding="utf-8"))
    generated = client.get("/api/openapi.json").json()
    for route, operations in contract["paths"].items():
        assert route in generated["paths"]
        for method in operations:
            assert method in generated["paths"][route]
    assert generated == contract
    assert sum(len(methods) for methods in generated["paths"].values()) == 10
    response_schema = generated["paths"]["/api/applications"]["post"]["responses"]["422"]
    assert response_schema["content"]["application/json"]["schema"]["$ref"].endswith(
        "ErrorResponse"
    )


def test_offline_swagger_assets(client):
    html = client.get("/api/docs").text
    assert 'src="https://' not in html
    assert 'href="https://' not in html
    assert '"validatorUrl": null' in html
    assert client.get("/api/static/swagger/swagger-ui-bundle.js").status_code == 200
    assert client.get("/api/static/swagger/swagger-ui.css").status_code == 200
