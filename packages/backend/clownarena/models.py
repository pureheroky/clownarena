from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import JSON, Boolean, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from clownarena.database import Base, utcnow
from clownarena.enums import (
    DuelMode,
    DuelRoomType,
    DuelStakeStatus,
    DuelStatus,
    OpponentProgress,
    ParticipantFinalStatus,
    ProblemStatus,
    ReferenceSolutionStatus,
    SubmissionStatus,
    TestKind,
    WalletTransactionType,
)


def _uuid() -> str:
    return str(uuid4())


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    username: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    rating: Mapped[int] = mapped_column(Integer, default=1200)
    clown_tokens_balance: Mapped[int] = mapped_column(Integer, default=0)
    last_daily_claim_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Problem(Base):
    __tablename__ = "problems"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    author_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(140))
    slug: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    description: Mapped[str] = mapped_column(Text)
    input_spec: Mapped[str] = mapped_column(Text, default="")
    output_spec: Mapped[str] = mapped_column(Text, default="")
    constraints_text: Mapped[str] = mapped_column(Text, default="")
    difficulty: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[ProblemStatus] = mapped_column(Enum(ProblemStatus), default=ProblemStatus.DRAFT)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    is_duel_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    active_version_id: Mapped[str | None] = mapped_column(
        ForeignKey("problem_versions.id", ondelete="SET NULL"),
        nullable=True,
    )
    validation_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class ProblemVersion(Base):
    __tablename__ = "problem_versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    problem_id: Mapped[str] = mapped_column(ForeignKey("problems.id", ondelete="CASCADE"), index=True)
    version_number: Mapped[int] = mapped_column(Integer)
    snapshot_json: Mapped[dict[str, Any]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ProblemExample(Base):
    __tablename__ = "problem_examples"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    problem_id: Mapped[str] = mapped_column(ForeignKey("problems.id", ondelete="CASCADE"), index=True)
    input_data: Mapped[str] = mapped_column(Text)
    output_data: Mapped[str] = mapped_column(Text)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0)


class TestCase(Base):
    __tablename__ = "test_cases"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    problem_id: Mapped[str] = mapped_column(ForeignKey("problems.id", ondelete="CASCADE"), index=True)
    input_data: Mapped[str] = mapped_column(Text)
    expected_output: Mapped[str] = mapped_column(Text)
    kind: Mapped[TestKind] = mapped_column(Enum(TestKind))
    weight: Mapped[int] = mapped_column(Integer, default=1)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ReferenceSolution(Base):
    __tablename__ = "reference_solutions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    problem_id: Mapped[str] = mapped_column(
        ForeignKey("problems.id", ondelete="CASCADE"),
        unique=True,
        index=True,
    )
    language: Mapped[str] = mapped_column(String(32), default="python")
    code: Mapped[str] = mapped_column(Text)
    validation_status: Mapped[ReferenceSolutionStatus] = mapped_column(
        Enum(ReferenceSolutionStatus),
        default=ReferenceSolutionStatus.PENDING,
    )
    validation_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_validated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class Duel(Base):
    __tablename__ = "duels"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    problem_id: Mapped[str] = mapped_column(ForeignKey("problems.id", ondelete="RESTRICT"), index=True)
    problem_version_id: Mapped[str] = mapped_column(
        ForeignKey("problem_versions.id", ondelete="RESTRICT"),
        index=True,
    )
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    player1_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    player2_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    status: Mapped[DuelStatus] = mapped_column(Enum(DuelStatus), default=DuelStatus.WAITING_FOR_OPPONENT)
    duel_mode: Mapped[DuelMode] = mapped_column(Enum(DuelMode), default=DuelMode.PRIVATE_ROOM)
    room_type: Mapped[DuelRoomType] = mapped_column(
        Enum(
            DuelRoomType,
            name="duelroomtype",
            values_callable=lambda items: [item.value for item in items],
        ),
        default=DuelRoomType.RATED,
    )
    max_duration_sec: Mapped[int] = mapped_column(Integer, default=1200)
    stake_amount: Mapped[int] = mapped_column(Integer)
    room_code: Mapped[str] = mapped_column(String(12), unique=True, index=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    countdown_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ready_deadline_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    winner_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    ended_reason: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class DuelParticipant(Base):
    __tablename__ = "duel_participants"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    duel_id: Mapped[str] = mapped_column(ForeignKey("duels.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    seat: Mapped[int] = mapped_column(Integer)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    ready_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    final_status: Mapped[ParticipantFinalStatus] = mapped_column(
        Enum(ParticipantFinalStatus),
        default=ParticipantFinalStatus.PENDING,
    )
    penalty_seconds: Mapped[int] = mapped_column(Integer, default=0)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    best_passed_weight: Mapped[int] = mapped_column(Integer, default=0)
    best_submission_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    disconnect_deadline_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    opponent_progress: Mapped[OpponentProgress] = mapped_column(
        Enum(OpponentProgress),
        default=OpponentProgress.THINKING,
    )


class Submission(Base):
    __tablename__ = "submissions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    duel_id: Mapped[str] = mapped_column(ForeignKey("duels.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    problem_id: Mapped[str] = mapped_column(ForeignKey("problems.id", ondelete="RESTRICT"), index=True)
    problem_version_id: Mapped[str] = mapped_column(
        ForeignKey("problem_versions.id", ondelete="RESTRICT"),
        index=True,
    )
    code: Mapped[str] = mapped_column(Text)
    language: Mapped[str] = mapped_column(String(32), default="python")
    status: Mapped[SubmissionStatus] = mapped_column(Enum(SubmissionStatus), default=SubmissionStatus.QUEUED)
    passed_tests: Mapped[int] = mapped_column(Integer, default=0)
    total_tests: Mapped[int] = mapped_column(Integer, default=0)
    passed_weight: Mapped[int] = mapped_column(Integer, default=0)
    execution_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    memory_kb: Mapped[int | None] = mapped_column(Integer, nullable=True)
    stdout_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    stderr_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    sample_results_json: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class SubmissionTestResult(Base):
    __tablename__ = "submission_test_results"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    submission_id: Mapped[str] = mapped_column(
        ForeignKey("submissions.id", ondelete="CASCADE"),
        index=True,
    )
    test_case_id: Mapped[str | None] = mapped_column(
        ForeignKey("test_cases.id", ondelete="SET NULL"),
        nullable=True,
    )
    status: Mapped[SubmissionStatus] = mapped_column(Enum(SubmissionStatus))
    execution_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    memory_kb: Mapped[int | None] = mapped_column(Integer, nullable=True)


class RatingHistory(Base):
    __tablename__ = "rating_history"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    duel_id: Mapped[str] = mapped_column(ForeignKey("duels.id", ondelete="CASCADE"), index=True)
    old_rating: Mapped[int] = mapped_column(Integer)
    new_rating: Mapped[int] = mapped_column(Integer)
    delta: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class WalletTransaction(Base):
    __tablename__ = "wallet_transactions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    duel_id: Mapped[str | None] = mapped_column(
        ForeignKey("duels.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    amount: Mapped[int] = mapped_column(Integer)
    balance_after: Mapped[int] = mapped_column(Integer)
    transaction_type: Mapped[WalletTransactionType] = mapped_column(Enum(WalletTransactionType))
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class DuelStake(Base):
    __tablename__ = "duel_stakes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    duel_id: Mapped[str] = mapped_column(ForeignKey("duels.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    amount: Mapped[int] = mapped_column(Integer)
    status: Mapped[DuelStakeStatus] = mapped_column(Enum(DuelStakeStatus), default=DuelStakeStatus.RESERVED)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    settled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
