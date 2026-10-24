from pydantic import BaseModel, ConfigDict

from app.domain.types import Segment


class FeedArticleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    segment: Segment
    title: str
    summary: str
    full_text: str
    tag: str
    reading_minutes: int
    synthetic: bool
