from typing import Literal

from fastapi import APIRouter
from sqlalchemy import select

from app.api.dependencies import DbSession
from app.db.models import FeedArticle
from app.domain.types import Segment
from app.schemas.feed import FeedArticleResponse, FeedResponse

router = APIRouter(prefix="/feed", tags=["feed"])


@router.get("", response_model=FeedResponse)
async def feed(
    session: DbSession,
    segment: Segment = Segment.GENERAL,
    context: Literal["default", "rejected"] = "default",
):
    query = select(FeedArticle).where(FeedArticle.segment == segment)
    if context == "rejected":
        query = query.order_by(FeedArticle.rejection_priority, FeedArticle.id)
    else:
        query = query.order_by(FeedArticle.id)
    labels = {
        "retail": "Для ритейла",
        "services": "Для сферы услуг",
        "production": "Для производства",
        "general": "Для вашего бизнеса",
    }
    reason = "Почему вы это видите: материалы подобраны под выбранный сегмент бизнеса."
    if context == "rejected":
        reason += " Сначала показаны советы по снижению нагрузки и кредитной истории."
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
