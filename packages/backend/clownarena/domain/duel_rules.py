from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from clownarena.enums import OpponentProgress, SubmissionStatus


FAILURE_STATUSES = {
    SubmissionStatus.WRONG_ANSWER,
    SubmissionStatus.COMPILE_ERROR,
    SubmissionStatus.RUNTIME_ERROR,
    SubmissionStatus.TIME_LIMIT_EXCEEDED,
    SubmissionStatus.MEMORY_LIMIT_EXCEEDED,
}


@dataclass(frozen=True)
class ParticipantProgress:
    user_id: str
    accepted_at: datetime | None = None
    best_passed_weight: int = 0
    penalty_seconds: int = 0
    best_submission_at: datetime | None = None


@dataclass(frozen=True)
class DuelDecision:
    winner_id: str | None
    loser_id: str | None
    is_draw: bool
    reason: str


def is_failure_status(status: SubmissionStatus) -> bool:
    return status in FAILURE_STATUSES


def penalty_for_status(status: SubmissionStatus, *, penalty_seconds: int) -> int:
    return penalty_seconds if is_failure_status(status) else 0


def fog_of_war_status(status: SubmissionStatus, *, passed_samples: int, total_samples: int) -> OpponentProgress:
    if status == SubmissionStatus.ACCEPTED:
        return OpponentProgress.ACCEPTED
    if total_samples and passed_samples == total_samples:
        return OpponentProgress.PASSED_SAMPLES
    if status in FAILURE_STATUSES or status in {SubmissionStatus.QUEUED, SubmissionStatus.RUNNING}:
        return OpponentProgress.SUBMITTED
    return OpponentProgress.THINKING


def determine_winner(first: ParticipantProgress, second: ParticipantProgress) -> DuelDecision:
    if first.accepted_at and second.accepted_at:
        if first.accepted_at < second.accepted_at:
            return DuelDecision(first.user_id, second.user_id, False, "accepted_first")
        if second.accepted_at < first.accepted_at:
            return DuelDecision(second.user_id, first.user_id, False, "accepted_first")
        return DuelDecision(None, None, True, "simultaneous_accept")

    if first.accepted_at:
        return DuelDecision(first.user_id, second.user_id, False, "single_accept")
    if second.accepted_at:
        return DuelDecision(second.user_id, first.user_id, False, "single_accept")

    if first.best_passed_weight != second.best_passed_weight:
        if first.best_passed_weight > second.best_passed_weight:
            return DuelDecision(first.user_id, second.user_id, False, "passed_weight")
        return DuelDecision(second.user_id, first.user_id, False, "passed_weight")

    if first.penalty_seconds != second.penalty_seconds:
        if first.penalty_seconds < second.penalty_seconds:
            return DuelDecision(first.user_id, second.user_id, False, "penalty")
        return DuelDecision(second.user_id, first.user_id, False, "penalty")

    if first.best_submission_at and second.best_submission_at:
        if first.best_submission_at < second.best_submission_at:
            return DuelDecision(first.user_id, second.user_id, False, "best_submission_at")
        if second.best_submission_at < first.best_submission_at:
            return DuelDecision(second.user_id, first.user_id, False, "best_submission_at")

    return DuelDecision(None, None, True, "draw")

