import hashlib
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from fastapi.responses import FileResponse

from app.api.access import CurrentUser, require_owner, visible_application
from app.api.dependencies import DbSession, PipelineDependency
from app.core.errors import AppError, ErrorResponse
from app.core.security import require_bank_token
from app.db.models import utc_now
from app.db.workflow_models import ApplicationDocument, ApplicationWorkflow
from app.domain.state_machine import Actor, Status
from app.schemas.applications import ApplicationResponse
from app.services.application_service import get_application, transition
from app.services.application_view import application_view
from app.services.documents import (
    FORMATS,
    MAX_FILE_BYTES,
    checklist_complete,
    document_path,
    get_document,
)

router = APIRouter(tags=["documents"])
BINARY_RESPONSES = {
    200: {
        "content": {media: {"schema": {"type": "string", "format": "binary"}} for media in FORMATS}
    }
}


@router.post(
    "/applications/{id}/documents",
    response_model=ApplicationResponse,
    responses={413: {"model": ErrorResponse}},
)
async def upload_document(
    id: str,
    request: Request,
    user: CurrentUser,
    session: DbSession,
    pipeline: PipelineDependency,
    file: Annotated[UploadFile, File()],
    kind: Annotated[str, Form(min_length=1, max_length=200)],
    consent: Annotated[bool, Form()],
):
    async with pipeline.lock:
        application = visible_application(session, id, user)
        require_owner(user)
        workflow = session.get(ApplicationWorkflow, id)
        if application.status != Status.INFO_REQUESTED or workflow is None:
            raise AppError(
                409, "INVALID_TRANSITION", "Банк не запрашивал документы по этой заявке."
            )
        if kind not in workflow.document_checklist:
            raise AppError(422, "VALIDATION_ERROR", "Выберите документ из списка банка.")
        if not consent:
            raise AppError(
                422, "VALIDATION_ERROR", "Подтвердите согласие на повторный запрос в БКИ."
            )
        if file.content_type not in FORMATS:
            raise AppError(422, "VALIDATION_ERROR", "Допустимы PDF, PNG и JPEG до 10 МБ.")
        signature, extension = FORMATS[file.content_type]
        first = await file.read(65536)
        if not first.startswith(signature):
            raise AppError(422, "VALIDATION_ERROR", "Содержимое файла не соответствует его типу.")
        filename = uuid4().hex + extension
        path = document_path(request.app.state.settings.document_directory, filename)
        path.parent.mkdir(parents=True, exist_ok=True)
        size = 0
        digest = hashlib.sha256()
        try:
            with path.open("xb") as output:
                chunk = first
                while chunk:
                    size += len(chunk)
                    if size > MAX_FILE_BYTES:
                        raise AppError(413, "VALIDATION_ERROR", "Размер файла превышает 10 МБ.")
                    output.write(chunk)
                    digest.update(chunk)
                    chunk = await file.read(65536)
            session.add(
                ApplicationDocument(
                    application_id=id,
                    kind=kind,
                    path=filename,
                    size=size,
                    sha256=digest.hexdigest(),
                    media_type=file.content_type,
                )
            )
            workflow.consent_at = utc_now()
            session.flush()
            complete = checklist_complete(session, id, workflow.document_checklist)
            target = Status.CHECKING_EGRUL if complete else Status.INFO_REQUESTED
            transition(
                session,
                application,
                target,
                Actor.CLIENT,
                {
                    "document_kind": kind,
                    "size": size,
                    "sha256": digest.hexdigest(),
                    "bki_consent": True,
                    "user": user.login,
                },
            )
            session.commit()
        except Exception:
            path.unlink(missing_ok=True)
            raise
        finally:
            await file.close()
        result = application_view(application)
        if complete:
            pipeline.start(id)
        return result


def download(session, request, application_id, document_id):
    document = get_document(session, application_id, document_id)
    path = document_path(request.app.state.settings.document_directory, document.path)
    if not path.is_file():
        raise AppError(404, "NOT_FOUND", "Файл документа не найден.")
    return FileResponse(
        path,
        media_type=document.media_type,
        filename=f"document-{document.id}{path.suffix}",
        headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"},
    )


@router.get(
    "/applications/{id}/documents/{document_id}",
    response_class=FileResponse,
    responses=BINARY_RESPONSES,
)
async def client_download(
    id: str, document_id: int, request: Request, session: DbSession, user: CurrentUser
):
    visible_application(session, id, user)
    return download(session, request, id, document_id)


@router.get(
    "/bank/applications/{id}/documents/{document_id}",
    dependencies=[Depends(require_bank_token)],
    response_class=FileResponse,
    responses=BINARY_RESPONSES,
)
async def bank_download(id: str, document_id: int, request: Request, session: DbSession):
    get_application(session, id)
    return download(session, request, id, document_id)
