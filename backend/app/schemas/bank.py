from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator


class BankDecisionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: Literal["approve", "reject", "counter", "request_info"]
    amount: Annotated[int | None, Field(strict=True, ge=300_000, le=15_000_000)] = None
    term_months: Annotated[int | None, Field(strict=True, ge=3, le=36)] = None
    checklist: list[
        Annotated[str, StringConstraints(min_length=1, max_length=200, strip_whitespace=True)]
    ] = Field(default_factory=list, max_length=10)
    comment: Annotated[
        str,
        StringConstraints(strict=True, strip_whitespace=True, max_length=500),
    ] = ""

    @model_validator(mode="after")
    def validate_action(self):
        if self.action == "counter" and (self.amount is None or self.term_months is None):
            raise ValueError("Для других условий укажите сумму и срок")
        if self.action != "counter" and (self.amount is not None or self.term_months is not None):
            raise ValueError("Сумма и срок задаются только для других условий")
        if self.action == "request_info" and not self.checklist:
            raise ValueError("Укажите хотя бы один запрашиваемый документ")
        if self.action != "request_info" and self.checklist:
            raise ValueError("Список документов нужен только при запросе информации")
        return self
