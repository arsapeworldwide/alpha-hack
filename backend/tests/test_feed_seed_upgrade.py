from conftest import application_payload, wait_for_status
from sqlalchemy import func, select

from app.db.models import FeedArticle
from app.db.seed import seed_database
from app.db.seed_data import FEED_ARTICLES


def test_feed_upgrade_removes_legacy_content_and_preserves_application(client):
    response = client.post("/api/applications", json=application_payload())
    application_id = response.json()["id"]
    before = wait_for_status(client, application_id, "APPROVED")
    with client.app.state.session_factory() as session:
        session.add(
            FeedArticle(
                id="retail-cashflow",
                segment="retail",
                title="Legacy article",
                summary="Legacy summary",
                full_text="Legacy body",
                tag="Legacy",
                reading_minutes=2,
            )
        )
        current_id = FEED_ARTICLES["segments"]["retail"][0]["id"]
        session.get(FeedArticle, current_id).title = "Outdated title"
        session.commit()
        seed_database(session)
        seed_database(session)
        assert session.get(FeedArticle, "retail-cashflow") is None
        assert (
            session.get(FeedArticle, current_id).title
            == (FEED_ARTICLES["segments"]["retail"][0]["title"])
        )
        expected = sum(len(items) for items in FEED_ARTICLES["segments"].values())
        expected += len(FEED_ARTICLES["segments"]) * len(FEED_ARTICLES["advice"])
        assert session.scalar(select(func.count()).select_from(FeedArticle)) == expected
    assert client.get(f"/api/applications/{application_id}").json() == before
