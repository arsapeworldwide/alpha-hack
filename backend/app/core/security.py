from secrets import compare_digest
from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import APIKeyHeader, HTTPAuthorizationCredentials

from app.api.access import bearer, current_user
from app.api.dependencies import DbSession
from app.core.errors import AppError

bank_token_header = APIKeyHeader(name="X-Bank-Token", scheme_name="BankToken", auto_error=False)


def require_bank_token(
    request: Request,
    token: Annotated[str | None, Depends(bank_token_header)],
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    session: DbSession,
) -> str:
    expected = request.app.state.settings.bank_api_token.get_secret_value()
    if token is not None:
        if (
            request.app.state.settings.demo_mode
            and expected
            and compare_digest(token.encode(), expected.encode())
        ):
            return "legacy-bank-token"
        raise AppError(401, "BANK_UNAUTHORIZED", "Требуется действующий токен банковской роли.")
    user = current_user(session, request, credentials)
    if user.role != "underwriter":
        raise AppError(403, "FORBIDDEN", "Рабочее место доступно только сотруднику банка.")
    return user.login
