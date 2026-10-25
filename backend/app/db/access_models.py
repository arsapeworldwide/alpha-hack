from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.models import Base


class User(Base):
    __tablename__ = "users"

    login: Mapped[str] = mapped_column(String(60), primary_key=True)
    password_hash: Mapped[str] = mapped_column(String(240))
    full_name: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(30))
    is_demo: Mapped[bool] = mapped_column(default=False)


class Membership(Base):
    __tablename__ = "memberships"

    user_login: Mapped[str] = mapped_column(ForeignKey("users.login"), primary_key=True)
    company_inn: Mapped[str] = mapped_column(ForeignKey("companies.inn"), primary_key=True)


class LoginSession(Base):
    __tablename__ = "login_sessions"

    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_login: Mapped[str] = mapped_column(ForeignKey("users.login"), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class DemoFailure(Base):
    __tablename__ = "demo_failures"

    source: Mapped[str] = mapped_column(String(20), primary_key=True)
    mode: Mapped[str] = mapped_column(String(10))
