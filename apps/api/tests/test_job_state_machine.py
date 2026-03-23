"""Unit tests for job state machine transitions — Story 01.1.f"""
import pytest
from app.schemas.job import VALID_TRANSITIONS


def test_draft_can_only_go_to_active():
    assert VALID_TRANSITIONS["draft"] == ["active"]


def test_active_can_go_to_paused_or_closed():
    assert set(VALID_TRANSITIONS["active"]) == {"paused", "closed"}


def test_paused_can_go_to_active_or_closed():
    assert set(VALID_TRANSITIONS["paused"]) == {"active", "closed"}


def test_closed_is_terminal():
    assert VALID_TRANSITIONS["closed"] == []


def test_all_statuses_have_transitions_defined():
    for status in ["draft", "active", "paused", "closed"]:
        assert status in VALID_TRANSITIONS


def test_cannot_go_from_closed_to_any_state():
    assert len(VALID_TRANSITIONS["closed"]) == 0


def test_draft_cannot_go_to_paused():
    assert "paused" not in VALID_TRANSITIONS["draft"]


def test_draft_cannot_go_to_closed():
    assert "closed" not in VALID_TRANSITIONS["draft"]
