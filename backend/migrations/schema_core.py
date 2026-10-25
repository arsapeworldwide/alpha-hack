# Frozen schema for revision 0001; changes belong in a new revision.
import sqlalchemy as sa
from alembic import op


def create_missing():
    existing = set(sa.inspect(op.get_bind()).get_table_names())
    if "companies" not in existing:
        op.create_table(
            "companies",
            sa.Column("inn", sa.String(length=12), nullable=False),
            sa.Column("name", sa.String(length=200), nullable=False),
            sa.Column("annual_revenue", sa.BigInteger(), nullable=False),
            sa.Column("monthly_payments", sa.BigInteger(), nullable=False),
            sa.Column(
                "credit_history",
                sa.Enum(
                    "excellent",
                    "fair",
                    "poor",
                    name="history",
                    native_enum=False,
                    create_constraint=True,
                ),
                nullable=False,
            ),
            sa.Column("business_age_years", sa.Integer(), nullable=False),
            sa.Column(
                "segment",
                sa.Enum(
                    "retail",
                    "services",
                    "production",
                    "general",
                    name="company_segment",
                    native_enum=False,
                    create_constraint=True,
                ),
                nullable=False,
            ),
            sa.Column("synthetic", sa.Boolean(), nullable=False),
            sa.CheckConstraint("annual_revenue > 0"),
            sa.CheckConstraint("business_age_years >= 0"),
            sa.CheckConstraint("monthly_payments >= 0"),
            sa.PrimaryKeyConstraint("inn"),
        )
    if "feed_articles" not in existing:
        op.create_table(
            "feed_articles",
            sa.Column("id", sa.String(length=60), nullable=False),
            sa.Column(
                "segment",
                sa.Enum(
                    "retail",
                    "services",
                    "production",
                    "general",
                    name="feed_segment",
                    native_enum=False,
                    create_constraint=True,
                ),
                nullable=False,
            ),
            sa.Column("title", sa.String(length=200), nullable=False),
            sa.Column("summary", sa.Text(), nullable=False),
            sa.Column("full_text", sa.Text(), nullable=False),
            sa.Column("tag", sa.String(length=60), nullable=False),
            sa.Column("reading_minutes", sa.Integer(), nullable=False),
            sa.Column("rejection_priority", sa.Integer(), nullable=False),
            sa.Column("synthetic", sa.Boolean(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
    if "feed_articles" not in existing:
        op.create_index(
            op.f("ix_feed_articles_segment"), "feed_articles", ["segment"], unique=False
        )
    if "applications" not in existing:
        op.create_table(
            "applications",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("company_inn", sa.String(length=12), nullable=False),
            sa.Column("company_snapshot", sa.JSON(), nullable=False),
            sa.Column("requested_amount", sa.BigInteger(), nullable=False),
            sa.Column("term_months", sa.Integer(), nullable=False),
            sa.Column(
                "goal",
                sa.Enum(
                    "working_capital",
                    "equipment",
                    "cash_gap",
                    name="goal",
                    native_enum=False,
                    create_constraint=True,
                ),
                nullable=False,
            ),
            sa.Column(
                "status",
                sa.Enum(
                    "DRAFT",
                    "SUBMITTED",
                    "CHECKING_EGRUL",
                    "CHECKING_BKI",
                    "SCORING",
                    "APPROVED",
                    "COUNTER_OFFER",
                    "REJECTED",
                    "NEEDS_RECHECK",
                    "OFFER_ACCEPTED",
                    "SIGNED",
                    "DISBURSED",
                    "MANUAL_REVIEW",
                    "INFO_REQUESTED",
                    name="status",
                    native_enum=False,
                    create_constraint=True,
                ),
                nullable=False,
            ),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("idempotency_key", sa.String(length=200), nullable=True),
            sa.Column("request_fingerprint", sa.String(length=64), nullable=True),
            sa.Column("score", sa.Integer(), nullable=True),
            sa.Column("rate", sa.Numeric(precision=5, scale=2), nullable=True),
            sa.Column("offered_amount", sa.BigInteger(), nullable=True),
            sa.Column("monthly_payment", sa.BigInteger(), nullable=True),
            sa.Column("overpayment", sa.BigInteger(), nullable=True),
            sa.Column("rejection_reason", sa.Text(), nullable=True),
            sa.Column("recommendations", sa.JSON(), nullable=False),
            sa.Column("reapply_date", sa.Date(), nullable=True),
            sa.Column("sign_attempts", sa.Integer(), nullable=False),
            sa.Column("manual_decision", sa.Boolean(), nullable=False),
            sa.Column("version", sa.Integer(), nullable=False),
            sa.CheckConstraint("goal != 'cash_gap' OR term_months <= 12"),
            sa.CheckConstraint("requested_amount BETWEEN 300000 AND 15000000"),
            sa.CheckConstraint("sign_attempts BETWEEN 0 AND 5"),
            sa.CheckConstraint("term_months BETWEEN 3 AND 36"),
            sa.ForeignKeyConstraint(
                ["company_inn"],
                ["companies.inn"],
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("idempotency_key"),
        )
    if "applications" not in existing:
        op.create_index(op.f("ix_applications_status"), "applications", ["status"], unique=False)
    if "application_events" not in existing:
        op.create_table(
            "application_events",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("application_id", sa.String(length=36), nullable=False),
            sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column(
                "from_status",
                sa.Enum(
                    "DRAFT",
                    "SUBMITTED",
                    "CHECKING_EGRUL",
                    "CHECKING_BKI",
                    "SCORING",
                    "APPROVED",
                    "COUNTER_OFFER",
                    "REJECTED",
                    "NEEDS_RECHECK",
                    "OFFER_ACCEPTED",
                    "SIGNED",
                    "DISBURSED",
                    "MANUAL_REVIEW",
                    "INFO_REQUESTED",
                    name="event_from_status",
                    native_enum=False,
                    create_constraint=True,
                ),
                nullable=True,
            ),
            sa.Column(
                "to_status",
                sa.Enum(
                    "DRAFT",
                    "SUBMITTED",
                    "CHECKING_EGRUL",
                    "CHECKING_BKI",
                    "SCORING",
                    "APPROVED",
                    "COUNTER_OFFER",
                    "REJECTED",
                    "NEEDS_RECHECK",
                    "OFFER_ACCEPTED",
                    "SIGNED",
                    "DISBURSED",
                    "MANUAL_REVIEW",
                    "INFO_REQUESTED",
                    name="event_to_status",
                    native_enum=False,
                    create_constraint=True,
                ),
                nullable=False,
            ),
            sa.Column(
                "actor",
                sa.Enum(
                    "system",
                    "client",
                    "bank",
                    name="event_actor",
                    native_enum=False,
                    create_constraint=True,
                ),
                nullable=False,
            ),
            sa.Column("details", sa.JSON(), nullable=False),
            sa.ForeignKeyConstraint(["application_id"], ["applications.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
    if "application_events" not in existing:
        op.create_index(
            op.f("ix_application_events_application_id"),
            "application_events",
            ["application_id"],
            unique=False,
        )
    if "factors" not in existing:
        op.create_table(
            "factors",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("application_id", sa.String(length=36), nullable=False),
            sa.Column("code", sa.String(length=40), nullable=False),
            sa.Column("name", sa.String(length=100), nullable=False),
            sa.Column("points", sa.String(length=64), nullable=False),
            sa.Column("maximum", sa.Integer(), nullable=False),
            sa.Column("explanation", sa.Text(), nullable=False),
            sa.ForeignKeyConstraint(["application_id"], ["applications.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("application_id", "code"),
        )
    if "factors" not in existing:
        op.create_index(
            op.f("ix_factors_application_id"), "factors", ["application_id"], unique=False
        )
