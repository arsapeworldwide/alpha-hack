from pathlib import Path

from sqlalchemy import select

from app.core.errors import AppError
from app.db.workflow_models import ApplicationDocument

MAX_FILE_BYTES = 10 * 1024 * 1024
FORMATS = {
    "application/pdf": (b"%PDF-", ".pdf"),
    "image/png": (b"\x89PNG\r\n\x1a\n", ".png"),
    "image/jpeg": (b"\xff\xd8\xff", ".jpg"),
}


def document_path(directory: str, filename: str) -> Path:
    root = Path(directory).resolve()
    target = (root / filename).resolve()
    if not target.is_relative_to(root):
        raise AppError(404, "NOT_FOUND", "Документ не найден.")
    return target


def get_document(session, application_id: str, document_id: int):
    document = session.get(ApplicationDocument, document_id)
    if document is None or document.application_id != application_id:
        raise AppError(404, "NOT_FOUND", "Документ не найден.")
    return document


def checklist_complete(session, application_id: str, checklist: list[str]) -> bool:
    present = set(
        session.scalars(
            select(ApplicationDocument.kind).where(
                ApplicationDocument.application_id == application_id
            )
        )
    )
    return bool(checklist) and set(checklist).issubset(present)
