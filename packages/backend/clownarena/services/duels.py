from __future__ import annotations

import secrets
import string
from datetime import timedelta
from typing import Any, cast

from sqlalchemy import desc, or_, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from clownarena.config import get_settings
from clownarena.database import SessionLocal, utcnow
from clownarena.domain.duel_rules import (
    ParticipantProgress,
    determine_winner,
    fog_of_war_status,
    penalty_for_status,
)
from clownarena.domain.rating import rate_match
from clownarena.domain.wallet import WalletError, ensure_valid_stake
from clownarena.enums import (
    DuelMode,
    DuelRoomType,
    DuelStatus,
    ParticipantFinalStatus,
    ProblemStatus,
    SubmissionStatus,
)
from clownarena.models import (
    Duel,
    DuelParticipant,
    DuelStake,
    Problem,
    ProblemVersion,
    RatingHistory,
    Submission,
    SubmissionTestResult,
    User,
    WalletTransaction,
)
from clownarena.schemas import (
    DuelProblemExampleSnapshotResponse,
    DuelProblemSnapshotResponse,
    DuelProblemVisibleTestSnapshotResponse,
    DuelParticipantResponse,
    DuelResponse,
    DuelStakeResponse,
    MatchHistoryItem,
    SubmissionResponse,
)
from clownarena.services.errors import ConflictError, ForbiddenError, NotFoundError
from clownarena.services.realtime import DuelEventBus
from clownarena.services.wallet import payout_duel_stakes, refund_duel_stake, reserve_duel_stake


def _room_code(length: int = 6) -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


async def _unique_room_code(session: AsyncSession) -> str:
    while True:
        code = _room_code()
        existing = await session.scalar(select(Duel).where(Duel.room_code == code))
        if existing is None:
            return code


async def _load_problem_version(
    session: AsyncSession,
    problem_version_id: str,
) -> tuple[ProblemVersion, Problem]:
    result = await session.execute(
        select(ProblemVersion, Problem)
        .join(Problem, ProblemVersion.problem_id == Problem.id)
        .where(ProblemVersion.id == problem_version_id)
    )
    record = result.first()
    if record is None:
        raise NotFoundError("Problem version not found.")
    version, problem = cast(tuple[ProblemVersion, Problem], tuple(record))
    return version, problem


async def _load_duel_by_id(session: AsyncSession, duel_id: str) -> Duel:
    duel = await session.get(Duel, duel_id)
    if duel is None:
        raise NotFoundError("Duel not found.")
    return duel


async def _load_duel_by_code(session: AsyncSession, room_code: str) -> Duel:
    duel = await session.scalar(select(Duel).where(Duel.room_code == room_code))
    if duel is None:
        raise NotFoundError("Duel not found.")
    return duel


async def _participants(session: AsyncSession, duel_id: str) -> list[DuelParticipant]:
    result = await session.scalars(
        select(DuelParticipant)
        .where(DuelParticipant.duel_id == duel_id)
        .order_by(DuelParticipant.seat)
    )
    return list(result.all())


async def _stakes(session: AsyncSession, duel_id: str) -> list[DuelStake]:
    result = await session.scalars(
        select(DuelStake).where(DuelStake.duel_id == duel_id).order_by(DuelStake.created_at)
    )
    return list(result.all())


async def _submissions(session: AsyncSession, duel_id: str) -> list[Submission]:
    result = await session.scalars(
        select(Submission)
        .where(Submission.duel_id == duel_id)
        .order_by(desc(Submission.created_at))
    )
    return list(result.all())


def _duel_deadline(duel: Duel):
    return None if duel.started_at is None else duel.started_at + timedelta(seconds=duel.max_duration_sec)


async def _duel_response(session: AsyncSession, duel: Duel) -> DuelResponse:
    participants = await _participants(session, duel.id)
    stakes = await _stakes(session, duel.id)
    submissions = await _submissions(session, duel.id)
    users = {participant.user_id: await session.get(User, participant.user_id) for participant in participants}
    version = await session.get(ProblemVersion, duel.problem_version_id)
    snapshot = version.snapshot_json if version else {}
    snapshot_examples = snapshot.get("examples", [])
    snapshot_tests = snapshot.get("tests", [])
    return DuelResponse(
        id=duel.id,
        problem_id=duel.problem_id,
        problem_version_id=duel.problem_version_id,
        created_by=duel.created_by,
        player1_id=duel.player1_id,
        player2_id=duel.player2_id,
        status=duel.status,
        duel_mode=duel.duel_mode,
        room_type=duel.room_type,
        max_duration_sec=duel.max_duration_sec,
        stake_amount=duel.stake_amount,
        room_code=duel.room_code,
        started_at=duel.started_at,
        finished_at=duel.finished_at,
        expires_at=duel.expires_at,
        countdown_started_at=duel.countdown_started_at,
        ready_deadline_at=duel.ready_deadline_at,
        winner_id=duel.winner_id,
        ended_reason=duel.ended_reason,
        created_at=duel.created_at,
        problem_snapshot=DuelProblemSnapshotResponse(
            title=snapshot.get("title", ""),
            description=snapshot.get("description", ""),
            input_spec=snapshot.get("input_spec", ""),
            output_spec=snapshot.get("output_spec", ""),
            constraints_text=snapshot.get("constraints_text", ""),
            difficulty=int(snapshot.get("difficulty", 1)),
            examples=[
                DuelProblemExampleSnapshotResponse(
                    input_data=str(item.get("input_data", "")),
                    output_data=str(item.get("output_data", "")),
                    explanation=item.get("explanation"),
                    order_index=int(item.get("order_index", 0)),
                )
                for item in snapshot_examples
            ],
            visible_tests=[
                DuelProblemVisibleTestSnapshotResponse(
                    input_data=str(item.get("input_data", "")),
                    expected_output=str(item.get("expected_output", "")),
                    order_index=int(item.get("order_index", 0)),
                )
                for item in snapshot_tests
                if item.get("kind") == "sample"
            ],
        ),
        participants=[
            (
                lambda user: DuelParticipantResponse(
                    id=item.id,
                    user_id=item.user_id,
                    username=user.username if user is not None else "Unknown player",
                    seat=item.seat,
                    joined_at=item.joined_at,
                    ready_at=item.ready_at,
                    final_status=item.final_status,
                    penalty_seconds=item.penalty_seconds,
                    accepted_at=item.accepted_at,
                    best_passed_weight=item.best_passed_weight,
                    best_submission_at=item.best_submission_at,
                    disconnect_deadline_at=item.disconnect_deadline_at,
                    opponent_progress=item.opponent_progress,
                )
            )(users.get(item.user_id))
            for item in participants
        ],
        stakes=[DuelStakeResponse.model_validate(item) for item in stakes],
        submissions=[SubmissionResponse.model_validate(item) for item in submissions],
    )


async def _participant_for_user(
    session: AsyncSession,
    duel_id: str,
    user_id: str,
) -> DuelParticipant:
    participant = await session.scalar(
        select(DuelParticipant).where(
            DuelParticipant.duel_id == duel_id, DuelParticipant.user_id == user_id
        )
    )
    if participant is None:
        raise ForbiddenError("You are not a participant in this duel.")
    return participant


async def _mark_duel_cancelled(
    session: AsyncSession,
    *,
    duel: Duel,
    status: DuelStatus,
    reason: str,
) -> None:
    duel.status = status
    duel.finished_at = utcnow()
    duel.ended_reason = reason
    participants = await _participants(session, duel.id)
    stakes = await _stakes(session, duel.id)

    users = {
        participant.user_id: await session.get(User, participant.user_id)
        for participant in participants
    }
    for participant in participants:
        participant.final_status = (
            ParticipantFinalStatus.EXPIRED if status == DuelStatus.EXPIRED else ParticipantFinalStatus.CANCELLED
        )
    for stake in stakes:
        user = users[stake.user_id]
        if user:
            await refund_duel_stake(session, user=user, stake=stake, duel_id=duel.id)


async def _settle_finished_duel(
    session: AsyncSession,
    *,
    duel: Duel,
    winner_id: str | None,
    reason: str,
    is_draw: bool,
) -> None:
    if duel.status == DuelStatus.FINISHED:
        return

    duel.status = DuelStatus.FINISHED
    duel.finished_at = utcnow()
    duel.ended_reason = reason
    duel.winner_id = winner_id

    participants = await _participants(session, duel.id)
    stakes = await _stakes(session, duel.id)
    users = {
        participant.user_id: await session.get(User, participant.user_id)
        for participant in participants
    }

    player_one = users.get(duel.player1_id)
    player_two = users.get(duel.player2_id) if duel.player2_id else None
    if player_one is None or player_two is None:
        raise ConflictError("Both duel players must exist for settlement.")

    if is_draw:
        for participant in participants:
            participant.final_status = ParticipantFinalStatus.DRAW
        for stake in stakes:
            owner = users.get(stake.user_id)
            if owner:
                await refund_duel_stake(session, user=owner, stake=stake, duel_id=duel.id)
        score_one = 0.5
    else:
        for participant in participants:
            if participant.user_id == winner_id:
                participant.final_status = ParticipantFinalStatus.WINNER
            else:
                participant.final_status = (
                    ParticipantFinalStatus.FORFEIT if reason == "disconnect_forfeit" else ParticipantFinalStatus.LOSER
                )
        winner = users[winner_id] if winner_id else None
        if winner is None:
            raise ConflictError("Winner must exist.")
        if duel.room_type == DuelRoomType.RATED:
            await payout_duel_stakes(session, winner=winner, stakes=stakes, duel_id=duel.id)
        score_one = 1.0 if duel.player1_id == winner_id else 0.0

    if duel.room_type == DuelRoomType.PRACTICE:
        return

    rating_one, rating_two = rate_match(player_one.rating, player_two.rating, score_one, k_factor=32)
    session.add(
        RatingHistory(
            user_id=player_one.id,
            duel_id=duel.id,
            old_rating=rating_one.old_rating,
            new_rating=rating_one.new_rating,
            delta=rating_one.delta,
        )
    )
    session.add(
        RatingHistory(
            user_id=player_two.id,
            duel_id=duel.id,
            old_rating=rating_two.old_rating,
            new_rating=rating_two.new_rating,
            delta=rating_two.delta,
        )
    )
    player_one.rating = rating_one.new_rating
    player_two.rating = rating_two.new_rating


async def sync_duel_status(
    session: AsyncSession,
    *,
    duel: Duel,
    event_bus: DuelEventBus | None = None,
) -> Duel:
    now = utcnow()
    settings = get_settings()
    previous_status = duel.status
    finish_payload: dict[str, Any] | None = None

    if duel.status == DuelStatus.WAITING_FOR_OPPONENT and now >= duel.expires_at:
        await _mark_duel_cancelled(session, duel=duel, status=DuelStatus.EXPIRED, reason="room_expired")
        await session.commit()
        finish_payload = {"duel_id": duel.id, "status": duel.status.value, "winner_id": duel.winner_id}
    elif (
        duel.status == DuelStatus.WAITING_FOR_OPPONENT
        and duel.ready_deadline_at is not None
        and now >= duel.ready_deadline_at
    ):
        await _mark_duel_cancelled(session, duel=duel, status=DuelStatus.CANCELLED, reason="ready_timeout")
        await session.commit()
        finish_payload = {"duel_id": duel.id, "status": duel.status.value, "winner_id": duel.winner_id}
    elif (
        duel.status == DuelStatus.COUNTDOWN
        and duel.countdown_started_at is not None
        and now >= duel.countdown_started_at + timedelta(seconds=settings.duel_countdown_seconds)
    ):
        duel.status = DuelStatus.ACTIVE
        duel.started_at = duel.countdown_started_at + timedelta(seconds=settings.duel_countdown_seconds)
        await session.commit()
        if event_bus:
            await event_bus.publish(duel.id, "duel_started", {"duel_id": duel.id})
    elif duel.status == DuelStatus.ACTIVE:
        participants = await _participants(session, duel.id)
        for participant in participants:
            if participant.disconnect_deadline_at and now >= participant.disconnect_deadline_at:
                opponent = next(item for item in participants if item.user_id != participant.user_id)
                await _settle_finished_duel(
                    session,
                    duel=duel,
                    winner_id=opponent.user_id,
                    reason="disconnect_forfeit",
                    is_draw=False,
                )
                await session.commit()
                finish_payload = {"duel_id": duel.id, "status": duel.status.value, "winner_id": duel.winner_id}
                break
        if duel.status == DuelStatus.ACTIVE:
            deadline = _duel_deadline(duel)
            if deadline and now >= deadline:
                first, second = participants
                decision = determine_winner(
                    ParticipantProgress(
                        user_id=first.user_id,
                        accepted_at=first.accepted_at,
                        best_passed_weight=first.best_passed_weight,
                        penalty_seconds=first.penalty_seconds,
                        best_submission_at=first.best_submission_at,
                    ),
                    ParticipantProgress(
                        user_id=second.user_id,
                        accepted_at=second.accepted_at,
                        best_passed_weight=second.best_passed_weight,
                        penalty_seconds=second.penalty_seconds,
                        best_submission_at=second.best_submission_at,
                    ),
                )
                await _settle_finished_duel(
                    session,
                    duel=duel,
                    winner_id=decision.winner_id,
                    reason=decision.reason,
                    is_draw=decision.is_draw,
                )
                await session.commit()
                finish_payload = {"duel_id": duel.id, "status": duel.status.value, "winner_id": duel.winner_id}

    if (
        event_bus
        and finish_payload
        and previous_status != duel.status
        and duel.status in {DuelStatus.EXPIRED, DuelStatus.CANCELLED, DuelStatus.FINISHED}
    ):
        await event_bus.publish(
            duel.id,
            "duel_finished",
            finish_payload,
        )
    return duel


async def create_private_duel(
    session: AsyncSession,
    *,
    creator: User,
    problem_version_id: str,
    room_type: DuelRoomType,
    stake_amount: int,
    max_duration_sec: int | None,
) -> DuelResponse:
    version, problem = await _load_problem_version(session, problem_version_id)
    if problem.status != ProblemStatus.READY_FOR_DUEL or not problem.is_public or not problem.is_duel_enabled:
        raise ConflictError("Problem is not available for duel.")
    if problem.active_version_id != version.id:
        raise ConflictError("Only the active published version can be used in a duel.")
    settings = get_settings()
    if room_type == DuelRoomType.RATED:
        try:
            ensure_valid_stake(stake_amount, min_stake=settings.min_stake, max_stake=settings.max_stake)
        except WalletError as exc:
            raise ConflictError(str(exc)) from exc
        if problem.author_id == creator.id:
            raise ForbiddenError("Rated rooms can only use tasks published by other players.")
        resolved_stake_amount = stake_amount
    else:
        if problem.author_id != creator.id:
            raise ForbiddenError("Practice rooms can only be created with your own published task.")
        resolved_stake_amount = 0

    duel = Duel(
        problem_id=problem.id,
        problem_version_id=version.id,
        created_by=creator.id,
        player1_id=creator.id,
        player2_id=None,
        duel_mode=DuelMode.PRIVATE_ROOM,
        room_type=room_type,
        max_duration_sec=max_duration_sec or settings.duel_max_duration_seconds,
        stake_amount=resolved_stake_amount,
        room_code=await _unique_room_code(session),
        expires_at=utcnow() + timedelta(minutes=settings.duel_room_expiry_minutes),
    )
    session.add(duel)
    await session.flush()
    session.add(DuelParticipant(duel_id=duel.id, user_id=creator.id, seat=1))
    if room_type == DuelRoomType.RATED:
        await reserve_duel_stake(session, duel_id=duel.id, user=creator, amount=resolved_stake_amount)
    await session.commit()
    await session.refresh(duel)
    return await _duel_response(session, duel)


async def join_private_duel(
    session: AsyncSession,
    *,
    challenger: User,
    room_code: str,
    event_bus: DuelEventBus | None = None,
) -> DuelResponse:
    duel = await _load_duel_by_code(session, room_code)
    await sync_duel_status(session, duel=duel, event_bus=event_bus)
    if duel.status != DuelStatus.WAITING_FOR_OPPONENT:
        raise ConflictError("This duel is no longer joinable.")
    if duel.player1_id == challenger.id:
        raise ConflictError("You are already in this duel.")
    if duel.player2_id is not None:
        raise ConflictError("This duel already has two players.")

    problem = await session.get(Problem, duel.problem_id)
    if problem is None:
        raise NotFoundError("Problem not found.")
    if duel.room_type == DuelRoomType.RATED and problem.author_id == challenger.id:
        raise ForbiddenError("You cannot join a rated duel on your own problem.")

    settings = get_settings()
    duel.player2_id = challenger.id
    duel.ready_deadline_at = utcnow() + timedelta(seconds=settings.duel_ready_timeout_seconds)
    session.add(DuelParticipant(duel_id=duel.id, user_id=challenger.id, seat=2))
    if duel.room_type == DuelRoomType.RATED:
        await reserve_duel_stake(session, duel_id=duel.id, user=challenger, amount=duel.stake_amount)
    await session.commit()
    if event_bus:
        await event_bus.publish(duel.id, "opponent_joined", {"duel_id": duel.id, "user_id": challenger.id})
    return await _duel_response(session, duel)


async def ready_up(
    session: AsyncSession,
    *,
    user: User,
    duel_id: str,
    event_bus: DuelEventBus | None = None,
) -> DuelResponse:
    duel = await _load_duel_by_id(session, duel_id)
    await sync_duel_status(session, duel=duel, event_bus=event_bus)
    if duel.status != DuelStatus.WAITING_FOR_OPPONENT:
        raise ConflictError("Duel is not readying anymore.")
    participant = await _participant_for_user(session, duel_id, user.id)
    participant.ready_at = participant.ready_at or utcnow()

    participants = await _participants(session, duel.id)
    if duel.player2_id and all(item.ready_at is not None for item in participants):
        duel.status = DuelStatus.COUNTDOWN
        duel.countdown_started_at = utcnow()
        await session.commit()
        if event_bus:
            await event_bus.publish(
                duel.id,
                "countdown_started",
                {"duel_id": duel.id, "seconds": get_settings().duel_countdown_seconds},
            )
        return await _duel_response(session, duel)

    await session.commit()
    if event_bus:
        await event_bus.publish(duel.id, "opponent_ready", {"duel_id": duel.id, "user_id": user.id})
    return await _duel_response(session, duel)


async def mark_connected(session: AsyncSession, *, duel_id: str, user_id: str) -> None:
    participant = await _participant_for_user(session, duel_id, user_id)
    if participant.disconnect_deadline_at is not None:
        participant.disconnect_deadline_at = None
        await session.commit()


async def mark_disconnected(
    session: AsyncSession,
    *,
    duel_id: str,
    user_id: str,
    event_bus: DuelEventBus | None = None,
) -> None:
    duel = await _load_duel_by_id(session, duel_id)
    if duel.status != DuelStatus.ACTIVE:
        return
    participant = await _participant_for_user(session, duel_id, user_id)
    participant.disconnect_deadline_at = utcnow() + timedelta(
        seconds=get_settings().duel_disconnect_grace_seconds
    )
    await session.commit()
    await sync_duel_status(session, duel=duel, event_bus=event_bus)


async def get_duel(
    session: AsyncSession,
    *,
    duel_id: str,
    viewer_id: str,
    event_bus: DuelEventBus | None = None,
) -> DuelResponse:
    duel = await _load_duel_by_id(session, duel_id)
    if viewer_id not in {duel.player1_id, duel.player2_id, duel.created_by}:
        raise ForbiddenError("You cannot view this duel.")
    await sync_duel_status(session, duel=duel, event_bus=event_bus)
    return await _duel_response(session, duel)


async def list_match_history(session: AsyncSession, *, user: User) -> list[MatchHistoryItem]:
    duels_result = await session.scalars(
        select(Duel)
        .where(
            Duel.status == DuelStatus.FINISHED,
            or_(Duel.player1_id == user.id, Duel.player2_id == user.id),
        )
        .order_by(desc(Duel.finished_at))
    )
    duels = list(duels_result.all())
    history: list[MatchHistoryItem] = []
    for duel in duels:
        rating = await session.scalar(
            select(RatingHistory).where(RatingHistory.duel_id == duel.id, RatingHistory.user_id == user.id)
        )
        wallet_delta_result = await session.scalars(
            select(WalletTransaction).where(
                WalletTransaction.duel_id == duel.id, WalletTransaction.user_id == user.id
            )
        )
        wallet_delta = list(wallet_delta_result.all())
        history.append(
            MatchHistoryItem(
                duel=await _duel_response(session, duel),
                rating_delta=rating.delta if rating else 0,
                wallet_delta=sum(item.amount for item in wallet_delta),
            )
        )
    return history


async def submit_solution(
    session: AsyncSession,
    *,
    user: User,
    duel_id: str,
    code: str,
    language: str,
    judge_gateway: Any,
    event_bus: DuelEventBus | None = None,
) -> SubmissionResponse:
    duel = await _load_duel_by_id(session, duel_id)
    await sync_duel_status(session, duel=duel, event_bus=event_bus)
    if duel.status != DuelStatus.ACTIVE:
        raise ConflictError("Submissions are allowed only during active duels.")
    if language != "python":
        raise ConflictError("Only Python submissions are supported in MVP.")
    await _participant_for_user(session, duel_id, user.id)

    version = await session.get(ProblemVersion, duel.problem_version_id)
    if version is None:
        raise NotFoundError("Problem version not found.")
    tests = version.snapshot_json.get("tests", [])
    submission = Submission(
        duel_id=duel.id,
        user_id=user.id,
        problem_id=duel.problem_id,
        problem_version_id=duel.problem_version_id,
        code=code,
        language=language,
        status=SubmissionStatus.QUEUED,
        total_tests=len(tests),
    )
    session.add(submission)
    await session.commit()
    await session.refresh(submission)
    await judge_gateway.enqueue_submission_evaluation(submission.id)
    if event_bus:
        await event_bus.publish(
            duel.id,
            "submission_update",
            {"submission_id": submission.id, "user_id": user.id, "status": submission.status.value},
        )
        await event_bus.publish(
            duel.id,
            "opponent_progress",
            {"user_id": user.id, "progress": "submitted"},
        )
    return SubmissionResponse.model_validate(submission)


async def apply_submission_result(
    session: AsyncSession,
    *,
    submission_id: str,
    status: SubmissionStatus,
    passed_tests: int,
    total_tests: int,
    passed_weight: int,
    execution_time_ms: int | None,
    memory_kb: int | None,
    stdout_text: str | None,
    stderr_text: str | None,
    sample_results_json: list[dict[str, Any]],
    test_results: list[dict[str, Any]],
    event_bus: DuelEventBus | None = None,
) -> Submission:
    submission = await session.get(Submission, submission_id)
    if submission is None:
        raise NotFoundError("Submission not found.")

    duel = await _load_duel_by_id(session, submission.duel_id)
    participant = await _participant_for_user(session, duel.id, submission.user_id)

    submission.status = status
    submission.passed_tests = passed_tests
    submission.total_tests = total_tests
    submission.passed_weight = passed_weight
    submission.execution_time_ms = execution_time_ms
    submission.memory_kb = memory_kb
    submission.stdout_text = stdout_text
    submission.stderr_text = stderr_text
    submission.sample_results_json = sample_results_json
    submission.finished_at = utcnow()

    for item in test_results:
        session.add(
            SubmissionTestResult(
                submission_id=submission.id,
                test_case_id=item.get("test_case_id"),
                status=item["status"],
                execution_time_ms=item.get("execution_time_ms"),
                memory_kb=item.get("memory_kb"),
            )
        )

    if passed_weight >= participant.best_passed_weight:
        participant.best_passed_weight = passed_weight
        participant.best_submission_at = submission.finished_at
    participant.penalty_seconds += penalty_for_status(
        status,
        penalty_seconds=get_settings().failure_penalty_seconds,
    )

    version = await session.get(ProblemVersion, duel.problem_version_id)
    tests = version.snapshot_json.get("tests", []) if version else []
    sample_tests = [item for item in tests if item.get("kind") == "sample"]
    passed_samples = min(passed_tests, len(sample_tests))
    participant.opponent_progress = fog_of_war_status(
        status,
        passed_samples=passed_samples,
        total_samples=len(sample_tests),
    )

    if status == SubmissionStatus.ACCEPTED and participant.accepted_at is None:
        participant.accepted_at = submission.finished_at
        await _settle_finished_duel(
            session,
            duel=duel,
            winner_id=participant.user_id,
            reason="single_accept",
            is_draw=False,
        )

    await session.commit()
    if event_bus:
        await event_bus.publish(
            duel.id,
            "submission_update",
            {
                "submission_id": submission.id,
                "user_id": submission.user_id,
                "status": submission.status.value,
                "passed_weight": submission.passed_weight,
            },
        )
        await event_bus.publish(
            duel.id,
            "opponent_progress",
            {"user_id": submission.user_id, "progress": participant.opponent_progress.value},
        )
        if duel.status == DuelStatus.FINISHED:
            await event_bus.publish(
                duel.id,
                "rating_updated",
                {"duel_id": duel.id, "winner_id": duel.winner_id},
            )
            await event_bus.publish(duel.id, "wallet_updated", {"duel_id": duel.id})
            await event_bus.publish(
                duel.id,
                "duel_finished",
                {"duel_id": duel.id, "status": duel.status.value, "winner_id": duel.winner_id},
            )
    return submission


async def activate_duel_after_countdown(
    duel_id: str,
    event_bus: DuelEventBus,
    *,
    session_factory: async_sessionmaker[AsyncSession] = SessionLocal,
) -> None:
    await __import__("asyncio").sleep(get_settings().duel_countdown_seconds)
    async with session_factory() as session:
        duel = await _load_duel_by_id(session, duel_id)
        await sync_duel_status(session, duel=duel, event_bus=event_bus)
