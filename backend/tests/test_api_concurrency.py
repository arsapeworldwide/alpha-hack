import asyncio

import httpx
from conftest import application_payload, make_settings

from app.main import create_app


def test_concurrent_idempotent_posts_create_one_application(tmp_path):
    async def scenario():
        app = create_app(make_settings(tmp_path))
        async with app.router.lifespan_context(app):
            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=app),
                base_url="http://test",
            ) as client:
                signed_in = await client.post(
                    "/api/auth/login", json={"login": "director", "password": "demo-credit-2026"}
                )
                client.headers["Authorization"] = "Bearer " + signed_in.json()["access_token"]
                responses = await asyncio.gather(
                    *(
                        client.post(
                            "/api/applications",
                            json=application_payload(),
                            headers={"Idempotency-Key": "concurrent"},
                        )
                        for _ in range(8)
                    )
                )
                assert [r.status_code for r in responses].count(201) == 1
                assert [r.status_code for r in responses].count(200) == 7
                assert len({r.json()["id"] for r in responses}) == 1
                application_id = responses[0].json()["id"]
                for _ in range(100):
                    detail = (await client.get(f"/api/applications/{application_id}")).json()
                    if detail["status"] == "APPROVED":
                        break
                    await asyncio.sleep(0.005)
                assert detail["status"] == "APPROVED"
                assert len(detail["events"]) == 6
                assert len(detail["decision"]["factors"]) == 5
                history = await client.get("/api/applications")
                assert len(history.json()) == 1

    asyncio.run(scenario())


def test_concurrent_signs_issue_one_signature(tmp_path):
    async def scenario():
        app = create_app(make_settings(tmp_path))
        async with app.router.lifespan_context(app):
            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=app),
                base_url="http://test",
            ) as client:
                signed_in = await client.post(
                    "/api/auth/login", json={"login": "director", "password": "demo-credit-2026"}
                )
                client.headers["Authorization"] = "Bearer " + signed_in.json()["access_token"]
                created = await client.post("/api/applications", json=application_payload())
                application_id = created.json()["id"]
                for _ in range(100):
                    detail = (await client.get(f"/api/applications/{application_id}")).json()
                    if detail["status"] == "APPROVED":
                        break
                    await asyncio.sleep(0.005)
                assert detail["status"] == "APPROVED"
                signed = await asyncio.gather(
                    *(
                        client.post(
                            f"/api/applications/{application_id}/sign", json={"code": "1234"}
                        )
                        for _ in range(2)
                    )
                )
                assert sorted(r.status_code for r in signed) == [200, 409]
                for _ in range(100):
                    detail = (await client.get(f"/api/applications/{application_id}")).json()
                    if detail["status"] == "DISBURSED":
                        break
                    await asyncio.sleep(0.005)
                assert detail["status"] == "DISBURSED"
                assert [e["to_status"] for e in detail["events"]].count("SIGNED") == 1

    asyncio.run(scenario())
