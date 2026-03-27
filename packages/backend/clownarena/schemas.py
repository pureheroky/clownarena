from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field

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


class APIModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserResponse(APIModel):
    id: str
    username: str
    email: EmailStr
    rating: int
    clown_tokens_balance: int
    last_daily_claim_at: datetime | None = None
    created_at: datetime


class SessionResponse(BaseModel):
    user: UserResponse


class LogoutResponse(BaseModel):
    ok: bool = True


class WalletTransactionResponse(APIModel):
    id: str
    amount: int
    balance_after: int
    transaction_type: WalletTransactionType
    metadata_json: dict[str, Any]
    created_at: datetime


class WalletResponse(BaseModel):
    balance: int
    last_daily_claim_at: datetime | None
    next_daily_claim_at: datetime | None
    transactions: list[WalletTransactionResponse]


class DailyClaimResponse(BaseModel):
    balance: int
    claimed_amount: int
    next_daily_claim_at: datetime


class ProblemCreateRequest(BaseModel):
    title: str = Field(min_length=3, max_length=140)
    description: str = Field(min_length=10)
    input_spec: str = ""
    output_spec: str = ""
    constraints_text: str = ""
    difficulty: int = Field(default=1, ge=1, le=5)


class ProblemUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=140)
    description: str | None = Field(default=None, min_length=10)
    input_spec: str | None = None
    output_spec: str | None = None
    constraints_text: str | None = None
    difficulty: int | None = Field(default=None, ge=1, le=5)
    is_public: bool | None = None
    is_duel_enabled: bool | None = None


class ProblemExampleCreateRequest(BaseModel):
    input_data: str
    output_data: str
    explanation: str | None = None
    order_index: int = Field(default=0, ge=0)


class ProblemExampleUpdateRequest(BaseModel):
    input_data: str
    output_data: str
    explanation: str | None = None
    order_index: int = Field(default=0, ge=0)


class TestCaseCreateRequest(BaseModel):
    input_data: str
    expected_output: str
    kind: TestKind
    weight: int = Field(default=1, ge=1, le=100)
    order_index: int = Field(default=0, ge=0)


class TestCaseUpdateRequest(BaseModel):
    input_data: str
    expected_output: str
    kind: TestKind
    weight: int = Field(default=1, ge=1, le=100)
    order_index: int = Field(default=0, ge=0)


class ReferenceSolutionRequest(BaseModel):
    language: str = Field(default="python", pattern="^python$")
    code: str = Field(min_length=1)


class ProblemPublishRequest(BaseModel):
    is_public: bool = True
    is_duel_enabled: bool = True


class ProblemExampleResponse(APIModel):
    id: str
    input_data: str
    output_data: str
    explanation: str | None = None
    order_index: int


class TestCaseResponse(APIModel):
    id: str
    input_data: str
    expected_output: str
    kind: TestKind
    weight: int
    order_index: int


class ReferenceSolutionResponse(APIModel):
    id: str
    language: str
    code: str
    validation_status: ReferenceSolutionStatus
    needs_validation: bool = False
    validation_error: str | None = None
    last_validated_at: datetime | None = None
    updated_at: datetime


class ProblemVersionResponse(APIModel):
    id: str
    version_number: int
    snapshot_json: dict[str, Any]
    created_at: datetime


class ProblemResponse(APIModel):
    id: str
    author_id: str
    title: str
    slug: str
    description: str
    input_spec: str
    output_spec: str
    constraints_text: str
    difficulty: int
    status: ProblemStatus
    is_public: bool
    is_duel_enabled: bool
    active_version_id: str | None = None
    validation_notes: str | None = None
    created_at: datetime
    updated_at: datetime
    examples: list[ProblemExampleResponse] = Field(default_factory=list)
    tests: list[TestCaseResponse] = Field(default_factory=list)
    reference_solution: ReferenceSolutionResponse | None = None
    versions: list[ProblemVersionResponse] = Field(default_factory=list)


class ProblemSummaryResponse(APIModel):
    id: str
    title: str
    slug: str
    difficulty: int
    status: ProblemStatus
    active_version_id: str | None = None
    validation_notes: str | None = None
    updated_at: datetime
    tests_count: int
    examples_count: int


class DuelCatalogProblemResponse(APIModel):
    id: str
    title: str
    slug: str
    description: str
    difficulty: int
    active_version_id: str
    author_id: str
    author_username: str
    updated_at: datetime


class DuelCatalogResponse(BaseModel):
    rated: list[DuelCatalogProblemResponse] = Field(default_factory=list)
    practice: list[DuelCatalogProblemResponse] = Field(default_factory=list)


class DuelCreateRequest(BaseModel):
    problem_version_id: str
    room_type: DuelRoomType = DuelRoomType.RATED
    stake_amount: int = Field(default=0, ge=0)
    max_duration_sec: int | None = Field(default=None, ge=60, le=3600)


class DuelJoinRequest(BaseModel):
    room_code: str = Field(min_length=4, max_length=12)


class DuelParticipantResponse(APIModel):
    id: str
    user_id: str
    username: str
    seat: int
    joined_at: datetime
    ready_at: datetime | None = None
    final_status: ParticipantFinalStatus
    penalty_seconds: int
    accepted_at: datetime | None = None
    best_passed_weight: int
    best_submission_at: datetime | None = None
    disconnect_deadline_at: datetime | None = None
    opponent_progress: OpponentProgress


class SubmissionCreateRequest(BaseModel):
    code: str = Field(min_length=1)
    language: str = Field(default="python", pattern="^python$")


class SubmissionTestResultResponse(APIModel):
    id: str
    test_case_id: str | None = None
    status: SubmissionStatus
    execution_time_ms: int | None = None
    memory_kb: int | None = None


class SubmissionResponse(APIModel):
    id: str
    duel_id: str
    user_id: str
    problem_id: str
    problem_version_id: str
    language: str
    status: SubmissionStatus
    passed_tests: int
    total_tests: int
    passed_weight: int
    execution_time_ms: int | None = None
    memory_kb: int | None = None
    stdout_text: str | None = None
    stderr_text: str | None = None
    sample_results_json: list[dict[str, Any]] = Field(default_factory=list)
    created_at: datetime
    finished_at: datetime | None = None


class DuelProblemExampleSnapshotResponse(BaseModel):
    input_data: str
    output_data: str
    explanation: str | None = None
    order_index: int


class DuelProblemVisibleTestSnapshotResponse(BaseModel):
    input_data: str
    expected_output: str
    order_index: int


class DuelProblemSnapshotResponse(BaseModel):
    title: str
    description: str
    input_spec: str
    output_spec: str
    constraints_text: str
    difficulty: int
    examples: list[DuelProblemExampleSnapshotResponse] = Field(default_factory=list)
    visible_tests: list[DuelProblemVisibleTestSnapshotResponse] = Field(default_factory=list)


class DuelStakeResponse(APIModel):
    id: str
    user_id: str
    amount: int
    status: DuelStakeStatus
    created_at: datetime
    settled_at: datetime | None = None


class DuelResponse(APIModel):
    id: str
    problem_id: str
    problem_version_id: str
    created_by: str
    player1_id: str
    player2_id: str | None = None
    status: DuelStatus
    duel_mode: DuelMode
    room_type: DuelRoomType
    max_duration_sec: int
    stake_amount: int
    room_code: str
    started_at: datetime | None = None
    finished_at: datetime | None = None
    expires_at: datetime
    countdown_started_at: datetime | None = None
    ready_deadline_at: datetime | None = None
    winner_id: str | None = None
    ended_reason: str | None = None
    created_at: datetime
    problem_snapshot: DuelProblemSnapshotResponse
    participants: list[DuelParticipantResponse] = Field(default_factory=list)
    stakes: list[DuelStakeResponse] = Field(default_factory=list)
    submissions: list[SubmissionResponse] = Field(default_factory=list)


class MatchHistoryItem(BaseModel):
    duel: DuelResponse
    rating_delta: int
    wallet_delta: int


class LeaderboardEntryResponse(APIModel):
    rank: int
    user_id: str
    username: str
    rating: int
    clown_tokens_balance: int


class LeaderboardsResponse(BaseModel):
    rating: list[LeaderboardEntryResponse]
    tokens: list[LeaderboardEntryResponse]


class JudgeSubmissionResult(BaseModel):
    submission_id: str
    status: SubmissionStatus
    passed_tests: int
    total_tests: int
    passed_weight: int
    execution_time_ms: int | None = None
    memory_kb: int | None = None
    tests: list[SubmissionTestResultResponse] = Field(default_factory=list)


class WebSocketEvent(BaseModel):
    event: str
    duel_id: str
    payload: dict[str, Any]
    created_at: datetime
