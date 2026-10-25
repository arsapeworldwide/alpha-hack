from conftest import application_payload, wait_for_status


def test_financial_data_cannot_be_overridden_by_application_body(client):
    payload = application_payload("7723456789")
    original = dict(payload["company"])
    payload["company"].update(
        annual_revenue=180_000_000,
        monthly_payments=0,
        credit_history="excellent",
        business_age_years=10,
    )
    response = client.post("/api/applications", json=payload)
    assert response.status_code == 201
    detail = wait_for_status(client, response.json()["id"], "REJECTED")
    assert detail["company"] == original
    assert detail["decision"]["score"] == 8
    registry = client.get("/api/companies/lookup?inn=7723456789").json()
    assert registry == original
