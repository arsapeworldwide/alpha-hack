import asyncio

import httpx
from conftest import application_payload, make_settings

from app.main import create_app


def test_bank_rejection_and_client_signature_are_serialized(tmp_path):
    async def scenario():
        app = create_app(make_settings(tmp_path))
        async with app.router.lifespan_context(app):
            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=app),
                base_url="http://test",
            ) as client:
                created = await client.post("/api/applications", json=application_payload())
                application_id = created.json()["id"]
                for _ in range(100):
                    detail = (await client.get(f"/api/applications/{application_id}")).json()
                    if detail["status"] == "APPROVED":
                        break
                    await asyncio.sleep(0.005)
                assert detail["status"] == "APPROVED"
                signed, rejected = await asyncio.gather(
                    client.post(f"/api/applications/{application_id}/sign", json={"code": "1234"}),
                    client.post(
                        f"/api/bank/applications/{application_id}/decision",
                        json={"action": "reject", "comment": "Конкурентная проверка"},
                        headers={"X-Bank-Token": "demo-bank-token"},
                    ),
                )
                assert sorted([signed.status_code, rejected.status_code]) == [200, 409]
                expected = "DISBURSED" if signed.status_code == 200 else "REJECTED"
                for _ in range(100):
                    detail = (await client.get(f"/api/applications/{application_id}")).json()
                    if detail["status"] == expected:
                        break
                    await asyncio.sleep(0.005)
                assert detail["status"] == expected
                assert detail["decision"]["manual"] is (rejected.status_code == 200)

    asyncio.run(scenario())
