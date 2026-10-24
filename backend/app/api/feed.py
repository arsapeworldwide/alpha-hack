from typing import Literal

from fastapi import APIRouter
from sqlalchemy import select

from app.api.dependencies import DbSession
from app.db.models import FeedArticle
from app.domain.types import Segment
from app.schemas.feed import FeedArticleResponse

router = APIRouter(prefix="/feed", tags=["feed"])


@router.get("", response_model=list[FeedArticleResponse])
async def feed(
    session: DbSession,
    segment: Segment = Segment.GENERAL,
    context: Literal["rejected"] | None = None,
):
    query = select(FeedArticle).where(FeedArticle.segment == segment)
    if context == "rejected":
        query = query.order_by(FeedArticle.rejection_priority, FeedArticle.id)
    else:
        query = query.order_by(FeedArticle.id)
    return list(session.scalars(query))
