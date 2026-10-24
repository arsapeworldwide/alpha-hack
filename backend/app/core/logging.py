import json
import logging
import re
from datetime import UTC, datetime
from time import monotonic
from uuid import uuid4

from starlette.datastructures import Headers, MutableHeaders

logger = logging.getLogger("credit")


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": datetime.fromtimestamp(record.created, UTC).isoformat(),
            "level": record.levelname,
            "event": record.getMessage(),
        }
        for name in ("request_id", "method", "route", "status", "duration_ms", "error_type"):
            if hasattr(record, name):
                payload[name] = getattr(record, name)
        return json.dumps(payload, ensure_ascii=False)


def configure_logging(level: str) -> None:
    # Стандартный access-log Uvicorn включает query string с ИНН; используем свой лог маршрута.
    logging.getLogger("uvicorn.access").disabled = True
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(JsonFormatter())
        logger.addHandler(handler)
    logger.setLevel(level.upper())
    logger.propagate = False


class RequestIdMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        candidate = Headers(scope=scope).get("x-request-id", "")
        request_id = candidate if re.fullmatch(r"[A-Za-z0-9._-]{1,64}", candidate) else str(uuid4())
        scope.setdefault("state", {})["request_id"] = request_id
        started = monotonic()
        status = 500

        async def send_response(message):
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
                MutableHeaders(scope=message)["X-Request-ID"] = request_id
            await send(message)

        try:
            await self.app(scope, receive, send_response)
        finally:
            route = scope.get("route")
            logger.info(
                "request_completed",
                extra={
                    "request_id": request_id,
                    "method": scope["method"],
                    "route": getattr(route, "path", "<unmatched>"),
                    "status": status,
                    "duration_ms": round((monotonic() - started) * 1000),
                },
            )
