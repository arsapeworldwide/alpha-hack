from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, StringConstraints


class BankDecisionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: Literal["approve", "reject"]
    comment: Annotated[
        str,
        StringConstraints(strict=True, strip_whitespace=True, max_length=500),
    ] = ""
