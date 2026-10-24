from secrets import compare_digest
from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import APIKeyHeader

from app.core.errors import AppError

bank_token_header = APIKeyHeader(name="X-Bank-Token", scheme_name="BankToken", auto_error=False)


def require_bank_token(
    request: Request,
    token: Annotated[str | None, Depends(bank_token_header)],
) -> None:
    expected = request.app.state.settings.bank_api_token.get_secret_value()
    if not token or not expected or not compare_digest(token.encode(), expected.encode()):
        raise AppError(401, "BANK_UNAUTHORIZED", "Требуется действующий токен банковской роли.")
