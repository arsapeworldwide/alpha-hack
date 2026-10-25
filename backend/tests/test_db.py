import pytest
from conftest import load_scoring_cases
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm.exc import StaleDataError

from app.db.models import Application, ApplicationEvent, Company, FeedArticle, ScoringFactor
from app.db.seed import seed_database
from app.db.seed_data import FEED_ARTICLES
from app.db.session import build_engine, build_session_factory, initialize_database
from app.domain.state_machine import Actor, Status
from app.domain.types import Goal

TOTAL_ARTICLES = sum(
    len(a) + len(FEED_ARTICLES["advice"]) for a in FEED_ARTICLES["segments"].values()
)


@pytest.fixture
def database(tmp_path):
    url = f"sqlite:///{(tmp_path / 'nested' / 'credit.db').as_posix()}"
    engine = build_engine(url)
    initialize_database(engine)
    factory = build_session_factory(engine)
    with factory() as session:
        seed_database(session)
    yield engine, factory, url
    engine.dispose()


def new_application(**changes):
    return Application(
        company_inn="7712345678",
        requested_amount=1_000_000,
        term_months=12,
        goal=Goal.WORKING_CAPITAL,
        **changes,
    )


def test_seed_is_idempotent_and_does_not_overwrite(database):
    _, factory, _ = database
    with factory() as session:
        session.get(Company, "7712345678").monthly_payments = 123
        session.commit()
        seed_database(session)
        assert session.scalar(select(func.count()).select_from(Company)) == 5
        assert session.get(Company, "7712345678").monthly_payments == 123
        for segment in ("retail", "services", "production", "general"):
            articles = session.scalars(select(FeedArticle).where(FeedArticle.segment == segment))
            articles = list(articles)
            expected = len(FEED_ARTICLES["segments"][segment]) + len(FEED_ARTICLES["advice"])
            assert len(articles) == expected
            assert all(a.synthetic and "Синтетический" in a.full_text for a in articles)


def test_seed_profiles_match_shared_scoring_cases(database):
    _, factory, _ = database
    with factory() as session:
        for case in load_scoring_cases()["profiles"][:3]:
            company = session.get(Company, case["inn"])
            for field in (
                "annual_revenue",
                "monthly_payments",
                "credit_history",
                "business_age_years",
            ):
                assert getattr(company, field) == case["input"][field]
            assert company.segment == case["segment"]


def test_persistence_across_engine_restart(database):
    engine, factory, url = database
    with factory() as session:
        application = new_application(status=Status.CHECKING_BKI)
        session.add(application)
        session.flush()
        application_id = application.id
        session.add(
            ApplicationEvent(
                application_id=application_id,
                from_status=Status.CHECKING_EGRUL,
                to_status=Status.CHECKING_BKI,
                actor=Actor.SYSTEM,
                details={"synthetic": True},
            )
        )
        session.commit()
    engine.dispose()
    restarted = build_engine(url)
    try:
        initialize_database(restarted)
        with build_session_factory(restarted)() as session:
            seed_database(session)
            saved = session.get(Application, application_id)
            assert saved.status == Status.CHECKING_BKI
            assert saved.events[0].actor == Actor.SYSTEM
    finally:
        restarted.dispose()


def test_delete_applications_cascades_and_preserves_seed(database):
    _, factory, _ = database
    with factory() as session:
        application = new_application()
        session.add(application)
        session.flush()
        session.add(
            ApplicationEvent(
                application_id=application.id, to_status=Status.DRAFT, actor=Actor.CLIENT
            )
        )
        session.add(
            ScoringFactor(
                application_id=application.id,
                code="history",
                name="История",
                points="35",
                maximum=35,
                explanation="Синтетическая история",
            )
        )
        session.commit()
        session.execute(delete(Application))
        session.commit()
        assert session.scalar(select(func.count()).select_from(ApplicationEvent)) == 0
        assert session.scalar(select(func.count()).select_from(ScoringFactor)) == 0
        assert session.scalar(select(func.count()).select_from(Company)) == 5
        assert session.scalar(select(func.count()).select_from(FeedArticle)) == TOTAL_ARTICLES


def test_idempotency_keys_are_unique(database):
    _, factory, _ = database
    with factory() as session:
        session.add_all(
            [new_application(idempotency_key="same"), new_application(idempotency_key="same")]
        )
        with pytest.raises(IntegrityError):
            session.commit()
        session.rollback()


def test_concurrent_updates_detect_conflict(database):
    _, factory, _ = database
    with factory() as session:
        application = new_application()
        session.add(application)
        session.commit()
        application_id = application.id
    with factory() as first, factory() as second:
        a = first.get(Application, application_id)
        b = second.get(Application, application_id)
        a.status = Status.SUBMITTED
        first.commit()
        b.status = Status.REJECTED
        with pytest.raises(StaleDataError):
            second.commit()
        second.rollback()


def test_foreign_key_enforcement(database):
    _, factory, _ = database
    with factory() as session:
        session.add(
            ApplicationEvent(application_id="missing", to_status=Status.DRAFT, actor=Actor.CLIENT)
        )
        with pytest.raises(IntegrityError):
            session.commit()
        session.rollback()
