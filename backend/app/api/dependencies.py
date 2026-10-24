from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.services.pipeline import Pipeline


def get_session(request: Request):
    with request.app.state.session_factory() as session:
        yield session


def get_pipeline(request: Request) -> Pipeline:
    return request.app.state.pipeline


DbSession = Annotated[Session, Depends(get_session)]
PipelineDependency = Annotated[Pipeline, Depends(get_pipeline)]
