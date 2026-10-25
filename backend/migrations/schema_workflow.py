# Frozen schema for revision 0001; changes belong in a new revision.
import sqlalchemy as sa
from alembic import op


def create_missing():
    existing = set(sa.inspect(op.get_bind()).get_table_names())
    if "products" not in existing:
        op.create_table(
            "products",
            sa.Column("code", sa.String(length=30), nullable=False),
            sa.Column("name", sa.String(length=120), nullable=False),
            sa.Column("goal", sa.String(length=30), nullable=False),
            sa.Column("description", sa.String(length=300), nullable=False),
            sa.Column("min_amount", sa.Integer(), nullable=False),
            sa.Column("max_amount", sa.Integer(), nullable=False),
            sa.Column("min_term", sa.Integer(), nullable=False),
            sa.Column("max_term", sa.Integer(), nullable=False),
            sa.Column("base_rate", sa.Integer(), nullable=False),
            sa.Column("auto_limit", sa.Integer(), nullable=False),
            sa.PrimaryKeyConstraint("code"),
        )
    if "application_documents" not in existing:
        op.create_table(
            "application_documents",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("application_id", sa.String(length=36), nullable=False),
            sa.Column("kind", sa.String(length=200), nullable=False),
            sa.Column("path", sa.String(length=160), nullable=False),
            sa.Column("media_type", sa.String(length=40), nullable=False),
            sa.Column("size", sa.Integer(), nullable=False),
            sa.Column("sha256", sa.String(length=64), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["application_id"], ["applications.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
    if "application_documents" not in existing:
        op.create_index(
            op.f("ix_application_documents_application_id"),
            "application_documents",
            ["application_id"],
            unique=False,
        )
    if "application_workflows" not in existing:
        op.create_table(
            "application_workflows",
            sa.Column("application_id", sa.String(length=36), nullable=False),
            sa.Column("product_code", sa.String(length=30), nullable=True),
            sa.Column("consent_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("document_checklist", sa.JSON(), nullable=False),
            sa.ForeignKeyConstraint(["application_id"], ["applications.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("application_id"),
        )
