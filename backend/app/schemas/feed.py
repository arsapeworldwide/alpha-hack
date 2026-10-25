from typing import Literal

from pydantic import BaseModel

from app.domain.types import Segment


class FeedArticleResponse(BaseModel):
    id: str
    title: str
    summary: str
    body: str
    tag: str
    read_minutes: int
    synthetic: Literal[True] = True


class FeedResponse(BaseModel):
    segment: Segment
    segment_label: str
    reason: str
    items: list[FeedArticleResponse]
