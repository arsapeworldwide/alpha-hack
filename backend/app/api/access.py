from datetime import UTC, datetime
from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select

from app.api.dependencies import DbSession
from app.core.errors import AppError
from app.core.passwords import token_hash
from app.db.access_models import LoginSession, Membership, User
from app.schemas.auth import UserResponse
from app.services.application_service import get_application

bearer = HTTPBearer(auto_error=False, scheme_name="SessionToken")


def user_view(session, user: User) -> UserResponse:
    inns = list(
        session.scalars(select(Membership.company_inn).where(Membership.user_login == user.login))
    )
    return UserResponse(
        login=user.login,
        full_name=user.full_name,
        role=user.role,
        company_inns=inns,
        can_manage_demo=user.login == "director" or user.role == "underwriter",
    )


def current_user(
    session: DbSession,
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> UserResponse:
    saved = session.get(LoginSession, token_hash(credentials.credentials)) if credentials else None
    if saved is None or saved.expires_at.replace(tzinfo=UTC) <= datetime.now(UTC):
        raise AppError(401, "UNAUTHORIZED", "Войдите в кредитный кабинет.")
    user = session.get(User, saved.user_login)
    if user is None:
        raise AppError(401, "UNAUTHORIZED", "Сессия недействительна.")
    if user.is_demo and not request.app.state.settings.demo_mode:
        raise AppError(401, "UNAUTHORIZED", "Демонстрационная учётная запись отключена.")
    return user_view(session, user)


CurrentUser = Annotated[UserResponse, Depends(current_user)]


def require_client(user: UserResponse) -> None:
    if user.role == "underwriter":
        raise AppError(403, "FORBIDDEN", "Используйте рабочее место банка.")


def require_owner(user: UserResponse) -> None:
    if user.role != "client_owner":
        raise AppError(403, "FORBIDDEN", "Это действие доступно только руководителю.")


def visible_application(session, application_id: str, user: UserResponse):
    application = get_application(session, application_id)
    if application.company_inn not in user.company_inns:
        raise AppError(404, "NOT_FOUND", "Заявка не найдена.")
    return application


def require_demo(request: Request, user: UserResponse, *, manage: bool = False) -> None:
    if not request.app.state.settings.demo_mode:
        raise AppError(404, "NOT_FOUND", "Демо-функция отключена.")
    if manage and not user.can_manage_demo:
        raise AppError(403, "FORBIDDEN", "Пульт доступен директору демо-группы и сотруднику банка.")
