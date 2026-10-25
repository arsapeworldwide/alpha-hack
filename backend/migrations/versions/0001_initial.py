from alembic import op
from sqlalchemy import CheckConstraint, inspect

from migrations.schema_access import create_missing as create_access
from migrations.schema_core import create_missing as create_core
from migrations.schema_workflow import create_missing as create_workflow

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

STATUSES = (
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
)


def upgrade():
    create_core()
    create_access()
    create_workflow()
    for table, fields in (
        ("applications", ("status",)),
        ("application_events", ("from_status", "to_status")),
    ):
        constraints = inspect(op.get_bind()).get_check_constraints(table)
        for field in fields:
            name = "status" if field == "status" else f"event_{field}"
            old = next((c for c in constraints if c["name"] == name), None)
            if old and "MANUAL_REVIEW" not in old["sqltext"]:
                values = ", ".join(f"'{status}'" for status in STATUSES)
                unnamed = tuple(
                    CheckConstraint(c["sqltext"]) for c in constraints if c["name"] is None
                )
                with op.batch_alter_table(table, table_args=unnamed) as batch:
                    batch.drop_constraint(name, type_="check")
                    batch.create_check_constraint(name, f"{field} IN ({values})")


def downgrade():
    raise RuntimeError("Восстановите резервную копию БД: автоматическое удаление заявок запрещено")
