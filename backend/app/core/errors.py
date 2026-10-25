from typing import Literal

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm.exc import StaleDataError
from starlette.exceptions import HTTPException

from app.domain.state_machine import InvalidTransition


class ErrorResponse(BaseModel):
    code: Literal[
        "VALIDATION_ERROR",
        "NOT_FOUND",
        "COMPANY_NOT_FOUND",
        "INVALID_TRANSITION",
        "INVALID_SIGN_CODE",
        "TOO_MANY_ATTEMPTS",
        "UNAUTHORIZED",
        "INTERNAL_ERROR",
    ]
    message: str
    details: dict = Field(default_factory=dict)


class AppError(Exception):
    def __init__(self, status: int, code: str, message: str, details: dict | None = None):
        self.status = status
        self.code = code
        self.message = message
        self.details = details or {}


def error_response(request: Request, status: int, code: str, message: str, details=None):
    public_codes = {
        "APPLICATION_NOT_FOUND": "NOT_FOUND",
        "BANK_UNAUTHORIZED": "UNAUTHORIZED",
        "SIGN_ATTEMPTS_EXCEEDED": "TOO_MANY_ATTEMPTS",
        "METHOD_NOT_ALLOWED": "NOT_FOUND",
        "IDEMPOTENCY_CONFLICT": "INVALID_TRANSITION",
        "UPDATE_CONFLICT": "INVALID_TRANSITION",
        "BANK_SCORING_REQUIRED": "INVALID_TRANSITION",
        "BANK_RATE_UNAVAILABLE": "INVALID_TRANSITION",
        "DATABASE_UNAVAILABLE": "INTERNAL_ERROR",
        "HTTP_ERROR": "INTERNAL_ERROR",
    }
    public_code = public_codes.get(code, code)
    if public_code != code:
        details = {**(details or {}), "reason": code}
    return JSONResponse(
        status_code=status,
        content={"code": public_code, "message": message, "details": details or {}},
        headers={"X-Request-ID": getattr(request.state, "request_id", "unknown")},
    )


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def application_error(request: Request, exc: AppError):
        return error_response(request, exc.status, exc.code, exc.message, exc.details)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        fields = [
            {"field": ".".join(str(p) for p in error["loc"]), "reason": error["type"]}
            for error in exc.errors()
        ]
        message = "Проверьте поля запроса: значения не соответствуют допустимому формату."
        locations = [error["loc"] for error in exc.errors()]
        if any(loc and loc[-1] == "inn" for loc in locations):
            message = "ИНН должен содержать 10 или 12 цифр."
        elif any(loc and loc[-1] == "requested_amount" for loc in locations):
            message = "Сумма должна быть целым числом от 300 000 до 15 000 000 рублей."
        elif any(error["type"] == "value_error" for error in exc.errors()):
            message = "Для кассового разрыва срок не более 12 месяцев."
        elif any(loc and loc[-1] == "term_months" for loc in locations):
            message = "Срок должен быть целым числом от 3 до 36 месяцев."
        return error_response(
            request,
            422,
            "VALIDATION_ERROR",
            message,
            {"fields": fields},
        )

    @app.exception_handler(InvalidTransition)
    async def transition_error(request: Request, exc: InvalidTransition):
        return error_response(request, 409, "INVALID_TRANSITION", str(exc))

    @app.exception_handler(StaleDataError)
    async def update_conflict(request: Request, _exc: StaleDataError):
        return error_response(request, 409, "UPDATE_CONFLICT", "Заявка уже изменена. Обновите её.")

    @app.exception_handler(SQLAlchemyError)
    async def database_error(request: Request, _exc: SQLAlchemyError):
        return error_response(
            request, 503, "DATABASE_UNAVAILABLE", "База данных временно недоступна."
        )

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, exc: HTTPException):
        code = {404: "NOT_FOUND", 405: "METHOD_NOT_ALLOWED"}.get(exc.status_code, "HTTP_ERROR")
        return error_response(request, exc.status_code, code, "Запрошенный маршрут недоступен.")

    @app.exception_handler(Exception)
    async def unexpected_error(request: Request, _exc: Exception):
        response = error_response(request, 500, "INTERNAL_ERROR", "Не удалось выполнить запрос.")
        # Обработчик 500 находится снаружи middleware CORS в стеке Starlette.
        origin = request.headers.get("origin")
        if origin in request.app.state.settings.cors_origins:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Expose-Headers"] = "X-Request-ID"
            response.headers["Vary"] = "Origin"
        return response


ERROR_RESPONSES = {
    status: {"model": ErrorResponse} for status in (400, 404, 409, 422, 429, 500, 503)
}
