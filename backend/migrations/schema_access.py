# Frozen schema for revision 0001; changes belong in a new revision.
import sqlalchemy as sa
from alembic import op


def create_missing():
    existing = set(sa.inspect(op.get_bind()).get_table_names())
    if "demo_failures" not in existing:
        op.create_table(
            "demo_failures",
            sa.Column("source", sa.String(length=20), nullable=False),
            sa.Column("mode", sa.String(length=10), nullable=False),
            sa.PrimaryKeyConstraint("source"),
        )
    if "users" not in existing:
        op.create_table(
            "users",
            sa.Column("login", sa.String(length=60), nullable=False),
            sa.Column("password_hash", sa.String(length=240), nullable=False),
            sa.Column("full_name", sa.String(length=120), nullable=False),
            sa.Column("role", sa.String(length=30), nullable=False),
            sa.Column("is_demo", sa.Boolean(), nullable=False),
            sa.PrimaryKeyConstraint("login"),
        )
    if "login_sessions" not in existing:
        op.create_table(
            "login_sessions",
            sa.Column("token_hash", sa.String(length=64), nullable=False),
            sa.Column("user_login", sa.String(length=60), nullable=False),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(
                ["user_login"],
                ["users.login"],
            ),
            sa.PrimaryKeyConstraint("token_hash"),
        )
    if "login_sessions" not in existing:
        op.create_index(
            op.f("ix_login_sessions_user_login"), "login_sessions", ["user_login"], unique=False
        )
    if "memberships" not in existing:
        op.create_table(
            "memberships",
            sa.Column("user_login", sa.String(length=60), nullable=False),
            sa.Column("company_inn", sa.String(length=12), nullable=False),
            sa.ForeignKeyConstraint(
                ["company_inn"],
                ["companies.inn"],
            ),
            sa.ForeignKeyConstraint(
                ["user_login"],
                ["users.login"],
            ),
            sa.PrimaryKeyConstraint("user_login", "company_inn"),
        )
