from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.models import Base, utc_now


class ApplicationWorkflow(Base):
    __tablename__ = "application_workflows"

    application_id: Mapped[str] = mapped_column(
        ForeignKey("applications.id", ondelete="CASCADE"), primary_key=True
    )
    product_code: Mapped[str | None] = mapped_column(String(30))
    consent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    document_checklist: Mapped[list] = mapped_column(JSON, default=list)


class ApplicationDocument(Base):
    __tablename__ = "application_documents"

    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[str] = mapped_column(
        ForeignKey("applications.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[str] = mapped_column(String(200))
    path: Mapped[str] = mapped_column(String(160))
    media_type: Mapped[str] = mapped_column(String(40))
    size: Mapped[int]
    sha256: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
