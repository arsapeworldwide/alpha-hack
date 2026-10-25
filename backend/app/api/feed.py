from typing import Literal

from fastapi import APIRouter
from sqlalchemy import select

from app.api.dependencies import DbSession
from app.db.models import FeedArticle
from app.db.seed import SEGMENT_PRIORITY_START
from app.domain.types import Segment
from app.schemas.feed import FeedArticleResponse, FeedResponse

router = APIRouter(prefix="/feed", tags=["feed"])

FEED_LIMIT = 5


@router.get("", response_model=FeedResponse)
async def feed(
    session: DbSession,
    segment: Segment = Segment.GENERAL,
    context: Literal["default", "rejected"] = "default",
):
    query = select(FeedArticle).where(FeedArticle.segment == segment)
    if context == "default":
        # Советы после отказа (priority < 10) в обычной ленте не показываем
        query = query.where(FeedArticle.rejection_priority >= SEGMENT_PRIORITY_START)
    query = query.order_by(FeedArticle.rejection_priority, FeedArticle.id).limit(FEED_LIMIT)
    labels = {
        "retail": "Для ритейла",
        "services": "Для услуг",
        "production": "Для производства",
        "general": "Для всех",
    }
    names = {"retail": "розничная торговля", "services": "услуги", "production": "производство"}
    if segment == "general":
        reason = (
            "Почему вы это видите: общие материалы для малого бизнеса. "
            "Выберите компанию, и лента подстроится под ваш сегмент."
        )
    else:
        reason = f"Почему вы это видите: ваш сегмент — {names[segment]}"
        if context == "rejected":
            reason += ". Первыми показаны советы, как повысить шансы на одобрение"
        reason += "."
    return FeedResponse(
        segment=segment,
        segment_label=labels[segment],
        reason=reason,
        items=[
            FeedArticleResponse(
                id=a.id,
                title=a.title,
                summary=a.summary,
                body=a.full_text,
                tag=a.tag,
                read_minutes=a.reading_minutes,
            )
            for a in session.scalars(query)
        ],
    )
