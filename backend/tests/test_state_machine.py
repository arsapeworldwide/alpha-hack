import pytest

from app.domain.state_machine import (
    Actor,
    InvalidTransition,
    Status,
    check_transition,
)


@pytest.mark.parametrize(
    "current,target",
    [
        (Status.SUBMITTED, Status.CHECKING_EGRUL),
        (Status.CHECKING_EGRUL, Status.CHECKING_BKI),
        (Status.CHECKING_BKI, Status.SCORING),
        (Status.CHECKING_BKI, Status.NEEDS_RECHECK),
        (Status.NEEDS_RECHECK, Status.CHECKING_BKI),
        (Status.SCORING, Status.APPROVED),
        (Status.SCORING, Status.COUNTER_OFFER),
        (Status.SCORING, Status.REJECTED),
        (Status.SIGNED, Status.DISBURSED),
    ],
)
def test_system_pipeline(current, target):
    check_transition(current, target, Actor.SYSTEM)


@pytest.mark.parametrize(
    "actor,current,target",
    [
        (Actor.CLIENT, Status.SUBMITTED, Status.APPROVED),
        (Actor.CLIENT, Status.SIGNED, Status.DISBURSED),
        (Actor.CLIENT, Status.CHECKING_BKI, Status.REJECTED),
        (Actor.SYSTEM, Status.COUNTER_OFFER, Status.SIGNED),
        (Actor.SYSTEM, Status.REJECTED, Status.APPROVED),
        (Actor.BANK, Status.SUBMITTED, Status.APPROVED),
        (Actor.SYSTEM, Status.DISBURSED, Status.SUBMITTED),
        (Actor.CLIENT, Status.APPROVED, Status.APPROVED),
    ],
)
def test_forbidden_transitions(actor, current, target):
    with pytest.raises(InvalidTransition, match="недоступен"):
        check_transition(current, target, actor)


def test_bank_override_requires_bank_actor():
    check_transition(Status.REJECTED, Status.APPROVED, Actor.BANK)
    check_transition(Status.APPROVED, Status.REJECTED, Actor.BANK)
    with pytest.raises(InvalidTransition):
        check_transition(Status.REJECTED, Status.APPROVED, Actor.CLIENT)


def test_client_paths():
    check_transition(Status.DRAFT, Status.SUBMITTED, Actor.CLIENT)
    check_transition(Status.APPROVED, Status.SIGNED, Actor.CLIENT)
    check_transition(Status.COUNTER_OFFER, Status.OFFER_ACCEPTED, Actor.CLIENT)
    check_transition(Status.OFFER_ACCEPTED, Status.SIGNED, Actor.CLIENT)
    with pytest.raises(InvalidTransition):
        check_transition(Status.COUNTER_OFFER, Status.SIGNED, Actor.CLIENT)
    with pytest.raises(InvalidTransition):
        check_transition(Status.REJECTED, Status.OFFER_ACCEPTED, Actor.CLIENT)


def test_bank_cannot_override_signed_or_disbursed():
    for status in (Status.SIGNED, Status.DISBURSED, Status.OFFER_ACCEPTED):
        with pytest.raises(InvalidTransition):
            check_transition(status, Status.REJECTED, Actor.BANK)
