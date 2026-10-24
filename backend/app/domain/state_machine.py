from enum import StrEnum


class Status(StrEnum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    CHECKING_EGRUL = "CHECKING_EGRUL"
    CHECKING_BKI = "CHECKING_BKI"
    SCORING = "SCORING"
    APPROVED = "APPROVED"
    COUNTER_OFFER = "COUNTER_OFFER"
    REJECTED = "REJECTED"
    NEEDS_RECHECK = "NEEDS_RECHECK"
    OFFER_ACCEPTED = "OFFER_ACCEPTED"
    SIGNED = "SIGNED"
    DISBURSED = "DISBURSED"


class Actor(StrEnum):
    SYSTEM = "system"
    CLIENT = "client"
    BANK = "bank"


STATUS_LABELS = dict(
    zip(
        Status,
        (
            "Черновик",
            "Заявка подана",
            "Проверка ЕГРЮЛ",
            "Проверка БКИ",
            "Скоринг",
            "Одобрено",
            "Встречное предложение",
            "Отказ",
            "Нужна повторная проверка",
            "Предложение принято",
            "Подписано",
            "Средства выданы",
        ),
        strict=True,
    )
)

TRANSITIONS: dict[Actor, dict[Status, frozenset[Status]]] = {
    Actor.CLIENT: {
        Status.DRAFT: frozenset({Status.SUBMITTED}),
        Status.APPROVED: frozenset({Status.SIGNED, Status.OFFER_ACCEPTED}),
        Status.COUNTER_OFFER: frozenset({Status.OFFER_ACCEPTED}),
        Status.OFFER_ACCEPTED: frozenset({Status.SIGNED}),
    },
    Actor.SYSTEM: {
        Status.SUBMITTED: frozenset({Status.CHECKING_EGRUL}),
        Status.CHECKING_EGRUL: frozenset({Status.CHECKING_BKI, Status.REJECTED}),
        Status.CHECKING_BKI: frozenset({Status.SCORING, Status.NEEDS_RECHECK}),
        Status.NEEDS_RECHECK: frozenset({Status.CHECKING_BKI}),
        Status.SCORING: frozenset({Status.APPROVED, Status.COUNTER_OFFER, Status.REJECTED}),
        Status.SIGNED: frozenset({Status.DISBURSED}),
    },
    Actor.BANK: {
        Status.APPROVED: frozenset({Status.REJECTED}),
        Status.COUNTER_OFFER: frozenset({Status.APPROVED, Status.REJECTED}),
        Status.REJECTED: frozenset({Status.APPROVED}),
        Status.NEEDS_RECHECK: frozenset({Status.APPROVED, Status.REJECTED}),
    },
}


class InvalidTransition(ValueError):
    pass


def check_transition(current: Status, target: Status, actor: Actor) -> None:
    if target not in TRANSITIONS.get(actor, {}).get(current, frozenset()):
        raise InvalidTransition(
            f"Переход «{STATUS_LABELS[current]}» → «{STATUS_LABELS[target]}» "
            f"недоступен для роли {actor}."
        )
