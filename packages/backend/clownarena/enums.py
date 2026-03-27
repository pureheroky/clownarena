from __future__ import annotations

from enum import Enum


class ProblemStatus(str, Enum):
    DRAFT = "draft"
    VALIDATION = "validation"
    READY_FOR_DUEL = "ready_for_duel"
    DISABLED = "disabled"


class TestKind(str, Enum):
    SAMPLE = "sample"
    HIDDEN = "hidden"
    EDGE = "edge"


class ReferenceSolutionStatus(str, Enum):
    MISSING = "missing"
    PENDING = "pending"
    ACCEPTED = "accepted"
    FAILED = "failed"


class DuelStatus(str, Enum):
    WAITING_FOR_OPPONENT = "waiting_for_opponent"
    COUNTDOWN = "countdown"
    ACTIVE = "active"
    FINISHED = "finished"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class DuelMode(str, Enum):
    PRIVATE_ROOM = "private_room"


class DuelRoomType(str, Enum):
    RATED = "rated"
    PRACTICE = "practice"


class ParticipantFinalStatus(str, Enum):
    PENDING = "pending"
    WINNER = "winner"
    LOSER = "loser"
    DRAW = "draw"
    CANCELLED = "cancelled"
    EXPIRED = "expired"
    FORFEIT = "forfeit"


class SubmissionStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    ACCEPTED = "accepted"
    WRONG_ANSWER = "wrong_answer"
    COMPILE_ERROR = "compile_error"
    RUNTIME_ERROR = "runtime_error"
    TIME_LIMIT_EXCEEDED = "time_limit_exceeded"
    MEMORY_LIMIT_EXCEEDED = "memory_limit_exceeded"
    INTERNAL_ERROR = "internal_error"


class WalletTransactionType(str, Enum):
    SIGNUP_BONUS = "signup_bonus"
    DAILY_CLAIM = "daily_claim"
    STAKE_RESERVE = "stake_reserve"
    STAKE_REFUND = "stake_refund"
    STAKE_PAYOUT = "stake_payout"


class DuelStakeStatus(str, Enum):
    RESERVED = "reserved"
    REFUNDED = "refunded"
    PAID_OUT = "paid_out"


class OpponentProgress(str, Enum):
    THINKING = "thinking"
    SUBMITTED = "submitted"
    PASSED_SAMPLES = "passed_samples"
    ACCEPTED = "accepted"
