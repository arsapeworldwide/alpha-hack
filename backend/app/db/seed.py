from sqlalchemy.orm import Session

from app.db.models import Company, FeedArticle
from app.db.seed_data import COMMON_ARTICLES, COMPANIES, REGISTRY_EXTRAS, SEGMENT_TIPS


def seed_database(session: Session) -> None:
    for company in (*COMPANIES, *REGISTRY_EXTRAS):
        if session.get(Company, company["inn"]) is None:
            session.add(Company(**company))
    for segment, tips in SEGMENT_TIPS.items():
        for key, title, tag, priority, summary, text in COMMON_ARTICLES:
            _add_article(session, segment, key, title, tag, priority, summary, text)
        _add_article(
            session,
            segment,
            "cashflow",
            "Планируйте денежный поток",
            "Денежный поток",
            10,
            "План поступлений и расходов помогает заранее увидеть нехватку денег. "
            "Регулярно обновляйте его по фактическим операциям.",
            tips[0],
        )
        _add_article(
            session,
            segment,
            "planning",
            "Как выбрать посильную сумму кредита",
            "Планирование",
            10,
            "Размер кредита стоит сравнивать с будущими платежами и запасом средств. "
            "Проверьте, выдержит ли бизнес платёж при снижении выручки.",
            tips[1],
        )
    session.commit()


def _add_article(
    session: Session,
    segment: str,
    key: str,
    title: str,
    tag: str,
    priority: int,
    summary: str,
    text: str,
) -> None:
    article_id = f"{segment}-{key}"
    if session.get(FeedArticle, article_id) is None:
        session.add(
            FeedArticle(
                id=article_id,
                segment=segment,
                title=title,
                summary=summary,
                full_text=f"Синтетический учебный контент.\n\n{summary}\n\n{text}",
                tag=tag,
                reading_minutes=2,
                rejection_priority=priority,
                synthetic=True,
            )
        )
