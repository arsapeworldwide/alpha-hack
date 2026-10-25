from collections import defaultdict, deque
from datetime import UTC, datetime, timedelta
from secrets import token_urlsafe
from time import monotonic

from fastapi import APIRouter, Request
from sqlalchemy import delete

from app.api.access import CurrentUser, user_view
from app.api.dependencies import DbSession
from app.core.errors import AppError
from app.core.passwords import token_hash, verify_password
from app.db.access_models import LoginSession, User
from app.db.access_seed import DEMO_USERS
from app.schemas.auth import DemoAccount, LoginRequest, LoginResponse, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest, request: Request, session: DbSession):
    attempts = request.app.state.login_attempts
    address = request.client.host if request.client else "unknown"
    now = monotonic()
    bucket = attempts[address]
    while bucket and bucket[0] <= now - 60:
        bucket.popleft()
    if len(bucket) >= 10:
        raise AppError(429, "TOO_MANY_ATTEMPTS", "Слишком много попыток входа. Подождите минуту.")
    user = session.get(User, payload.login)
    # Проверка хеша выполняется и для неизвестного логина, чтобы не раскрывать список учёток.
    from app.db.access_seed import demo_password_hash

    password_ok = verify_password(
        payload.password.get_secret_value(), user.password_hash if user else demo_password_hash()
    )
    if (
        user is None
        or not password_ok
        or (user.is_demo and not request.app.state.settings.demo_mode)
    ):
        bucket.append(now)
        raise AppError(401, "UNAUTHORIZED", "Неверный логин или пароль.")
    attempts.pop(address, None)
    token = token_urlsafe(32)
    lifetime = request.app.state.settings.session_hours * 3600
    session.execute(delete(LoginSession).where(LoginSession.expires_at <= datetime.now(UTC)))
    session.add(
        LoginSession(
            token_hash=token_hash(token),
            user_login=user.login,
            expires_at=datetime.now(UTC) + timedelta(seconds=lifetime),
        )
    )
    session.commit()
    return LoginResponse(access_token=token, expires_in=lifetime, user=user_view(session, user))


@router.get("/me", response_model=UserResponse)
async def me(user: CurrentUser):
    return user


@router.post("/logout")
async def logout(request: Request, session: DbSession, user: CurrentUser):
    token = request.headers.get("authorization", "").split(" ", 1)[-1]
    session.execute(delete(LoginSession).where(LoginSession.token_hash == token_hash(token)))
    session.commit()
    return {"status": "ok"}


@router.get("/demo-accounts", response_model=list[DemoAccount])
async def demo_accounts(request: Request):
    if not request.app.state.settings.demo_mode:
        raise AppError(404, "NOT_FOUND", "Демо-функция отключена.")
    return [
        DemoAccount(login=login, full_name=name, role=role, scenario=scenario)
        for login, name, role, scenario in DEMO_USERS
    ]


def login_attempts():
    return defaultdict(lambda: deque(maxlen=10))
