import asyncio

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import Settings
from app.core.logging import logger
from app.db.access_models import DemoFailure
from app.db.models import Application
from app.domain.state_machine import Status
from app.integrations.bki import BkiClient
from app.integrations.egrul import EgrulClient
from app.services.pipeline_steps import advance_pipeline

RECOVERABLE = {
    Status.SUBMITTED,
    Status.CHECKING_EGRUL,
    Status.CHECKING_BKI,
    Status.SCORING,
    Status.SIGNED,
    Status.NEEDS_RECHECK,
}


class Pipeline:
    def __init__(
        self,
        session_factory: sessionmaker[Session],
        settings: Settings,
        egrul: EgrulClient,
        bki: BkiClient,
    ):
        self.session_factory = session_factory
        self.settings = settings
        self.egrul = egrul
        self.bki = bki
        # Одна реплика API: сброс и клиентские действия не должны обгонять переходы pipeline.
        self.lock = asyncio.Lock()
        self.tasks: dict[str, asyncio.Task] = {}

    def start(self, application_id: str) -> None:
        existing = self.tasks.get(application_id)
        if existing is None or existing.done():
            task = asyncio.create_task(self._run(application_id))
            self.tasks[application_id] = task
            task.add_done_callback(lambda done: self._forget(application_id, done))

    def _forget(self, application_id: str, task: asyncio.Task) -> None:
        if self.tasks.get(application_id) is task:
            self.tasks.pop(application_id, None)

    def recover(self) -> None:
        with self.session_factory() as session:
            override = session.get(DemoFailure, "bki")
            failure = override.mode == "down" if override else self.settings.simulate_bki_failure
            for application in session.scalars(
                select(Application).where(
                    Application.status.in_(RECOVERABLE),
                )
            ):
                if application.status != Status.NEEDS_RECHECK or not failure:
                    self.start(application.id)

    async def cancel_all(self) -> None:
        tasks = list(self.tasks.values())
        for task in tasks:
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        self.tasks.clear()

    async def _run(self, application_id: str) -> None:
        try:
            while True:
                await asyncio.sleep(self.settings.pipeline_step_seconds)
                async with self.lock:
                    with self.session_factory() as session:
                        application = session.get(Application, application_id)
                        if application is None or not advance_pipeline(
                            session,
                            application,
                            self.egrul,
                            self.bki,
                        ):
                            return
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            # Состояние остаётся в БД для восстановления; параметры заявки в лог не попадают.
            logger.error("pipeline_interrupted", extra={"error_type": type(exc).__name__})
