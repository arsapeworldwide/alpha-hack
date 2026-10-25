from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.db.models import Company, FeedArticle
from app.db.seed_data import COMPANIES, FEED_ARTICLES, REGISTRY_EXTRAS

# Порядок в ленте задаёт rejection_priority:
# советы после отказа — 0, 1, 2…; статьи сегмента — 10, 11, 12…
SEGMENT_PRIORITY_START = 10


def seed_database(session: Session) -> None:
    for company in (*COMPANIES, *REGISTRY_EXTRAS):
        if session.get(Company, company["inn"]) is None:
            session.add(Company(**company))

    wanted: set[str] = set()
    for segment, articles in FEED_ARTICLES["segments"].items():
        for position, article in enumerate(articles):
            priority = SEGMENT_PRIORITY_START + position
            wanted.add(_upsert_article(session, segment, article["id"], article, priority))
        for position, article in enumerate(FEED_ARTICLES["advice"]):
            wanted.add(
                _upsert_article(session, segment, f"{segment}-{article['id']}", article, position)
            )
    # Убираем статьи прежних версий seed, чтобы в уже созданной базе не остались дубли
    session.execute(delete(FeedArticle).where(FeedArticle.id.not_in(wanted)))
    session.commit()


def _upsert_article(
    session: Session, segment: str, article_id: str, article: dict, priority: int
) -> str:
    values = {
        "segment": segment,
        "title": article["title"],
        "summary": article["summary"],
        "full_text": f"Синтетический учебный контент.\n\n{article['body']}",
        "tag": article["tag"],
        "reading_minutes": article["read_minutes"],
        "rejection_priority": priority,
        "synthetic": True,
    }
    existing = session.get(FeedArticle, article_id)
    if existing is None:
        session.add(FeedArticle(id=article_id, **values))
    else:
        for key, value in values.items():
            setattr(existing, key, value)
    return article_id
