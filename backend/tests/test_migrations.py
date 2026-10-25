from sqlalchemy import CheckConstraint, MetaData, func, inspect, select, text

from app.db.models import Application, ApplicationEvent, Base, Company, ScoringFactor
from app.db.seed_data import COMPANIES
from app.db.session import build_engine, build_session_factory, initialize_database


def test_legacy_enum_migration_preserves_applications_events_and_factors(tmp_path):
    from app.db import access_models  # noqa: F401

    engine = build_engine(f"sqlite:///{tmp_path / 'legacy.db'}")
    legacy = MetaData()
    for name in ("companies", "applications", "application_events", "factors", "feed_articles"):
        Base.metadata.tables[name].to_metadata(legacy)
    old_statuses = (
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
    )
    for table_name, names in [
        ("applications", {"status": "status"}),
        (
            "application_events",
            {"event_from_status": "from_status", "event_to_status": "to_status"},
        ),
    ]:
        for constraint in legacy.tables[table_name].constraints:
            if isinstance(constraint, CheckConstraint) and constraint.name in names:
                values = ",".join(repr(value) for value in old_statuses)
                constraint.sqltext = text(f"{names[constraint.name]} IN ({values})")
    legacy.create_all(engine)
    assert "MANUAL_REVIEW" not in str(inspect(engine).get_check_constraints("applications"))
    factory = build_session_factory(engine)
    with factory() as session:
        session.add(Company(**COMPANIES[0]))
        session.flush()
        application = Application(
            company_inn=COMPANIES[0]["inn"],
            company_snapshot=COMPANIES[0],
            requested_amount=1_000_000,
            term_months=12,
            goal="working_capital",
            status="SCORING",
        )
        session.add(application)
        session.flush()
        application_id = application.id
        session.add(
            ApplicationEvent(application_id=application_id, to_status="SCORING", actor="system")
        )
        session.add(
            ScoringFactor(
                application_id=application_id,
                code="history",
                name="History",
                points="35",
                maximum=35,
                explanation="legacy",
            )
        )
        session.commit()
    initialize_database(engine)
    initialize_database(engine)
    checks = str(inspect(engine).get_check_constraints("applications"))
    assert "requested_amount BETWEEN 300000 AND 15000000" in checks
    assert "sign_attempts BETWEEN 0 AND 5" in checks
    with factory() as session:
        assert session.get(Application, application_id).status == "SCORING"
        assert session.scalar(select(func.count()).select_from(ApplicationEvent)) == 1
        assert session.scalar(select(func.count()).select_from(ScoringFactor)) == 1
        session.get(Application, application_id).status = "MANUAL_REVIEW"
        session.add(
            ApplicationEvent(
                application_id=application_id,
                from_status="SCORING",
                to_status="MANUAL_REVIEW",
                actor="system",
            )
        )
        session.commit()
        assert session.scalar(text("select version_num from alembic_version")) == "0001"
    engine.dispose()
