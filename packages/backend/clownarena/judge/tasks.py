from __future__ import annotations

import asyncio
import logging

import dramatiq
from dramatiq.brokers.redis import RedisBroker
from sqlalchemy import select

from clownarena.config import get_settings
from clownarena.database import SessionLocal
from clownarena.enums import SubmissionStatus
from clownarena.models import Problem, ProblemVersion, ReferenceSolution, Submission
from clownarena.judge.sandbox import DockerSandbox, SandboxResult
from clownarena.services.duels import apply_submission_result
from clownarena.services.problems import finalize_problem_validation
from clownarena.services.realtime import DuelEventBus


settings = get_settings()
broker = RedisBroker(url=settings.redis_url)
dramatiq.set_broker(broker)
logger = logging.getLogger(__name__)


async def _validate_problem(problem_id: str) -> None:
    async with SessionLocal() as session:
        problem = await session.get(Problem, problem_id)
        if problem is None:
            return
        reference = await session.scalar(
            select(ReferenceSolution).where(ReferenceSolution.problem_id == problem_id)
        )
        tests = []
        if problem.active_version_id:
            version = await session.get(ProblemVersion, problem.active_version_id)
            if version:
                tests = version.snapshot_json.get("tests", [])
        if not tests:
            result = await session.execute(
                select(ProblemVersion.snapshot_json).where(ProblemVersion.problem_id == problem_id)
            )
            current_tests = list(result.scalars().all())
            if current_tests:
                tests = current_tests[-1].get("tests", [])
        if reference is None:
            await finalize_problem_validation(
                session,
                problem_id=problem_id,
                is_valid=False,
                notes="Reference solution is missing.",
            )
            return
        if not tests:
            from clownarena.models import TestCase

            raw_tests_result = await session.scalars(
                select(TestCase).where(TestCase.problem_id == problem_id)
            )
            raw_tests = list(raw_tests_result.all())
            tests = [
                {
                    "id": item.id,
                    "input_data": item.input_data,
                    "expected_output": item.expected_output,
                    "kind": item.kind.value,
                    "weight": item.weight,
                }
                for item in raw_tests
            ]

        try:
            sandbox = DockerSandbox()
            run, _, passed_tests, passed_weight = await sandbox.evaluate(reference.code, tests)
            is_valid = run.status.value == "accepted" and passed_tests == len(tests)
            notes = None if is_valid else run.stderr or run.status.value
        except Exception:
            logger.exception("Problem validation failed for %s", problem_id)
            is_valid = False
            notes = "Validation service is temporarily unavailable. Try again in a moment."
        await finalize_problem_validation(session, problem_id=problem_id, is_valid=is_valid, notes=notes)


async def _evaluate_submission(submission_id: str) -> None:
    async with SessionLocal() as session:
        submission = await session.get(Submission, submission_id)
        if submission is None:
            return
        version = await session.get(ProblemVersion, submission.problem_version_id)
        if version is None:
            return
        tests = version.snapshot_json.get("tests", [])
        try:
            sandbox = DockerSandbox()
            run, test_results, passed_tests, passed_weight = await sandbox.evaluate(
                submission.code, tests
            )
            sample_runs = await sandbox.inspect_visible_samples(
                submission.code,
                [test for test in tests if test.get("kind") == "sample"],
            )
        except Exception:
            logger.exception("Submission evaluation failed for %s", submission_id)
            run = SandboxResult(
                status=SubmissionStatus.INTERNAL_ERROR,
                stdout="",
                stderr="Judging service is temporarily unavailable. Try again in a moment.",
                execution_time_ms=None,
                memory_kb=None,
            )
            test_results = []
            passed_tests = 0
            passed_weight = 0
            sample_runs = []
        event_bus = DuelEventBus()
        await apply_submission_result(
            session,
            submission_id=submission_id,
            status=run.status,
            passed_tests=passed_tests,
            total_tests=len(tests),
            passed_weight=passed_weight,
            execution_time_ms=run.execution_time_ms,
            memory_kb=run.memory_kb,
            stdout_text=run.stdout,
            stderr_text=run.stderr,
            sample_results_json=[
                {
                    "input_data": item.input_data,
                    "expected_output": item.expected_output,
                    "actual_output": item.actual_output,
                    "stderr": item.stderr,
                    "status": item.status.value,
                    "execution_time_ms": item.execution_time_ms,
                    "memory_kb": item.memory_kb,
                }
                for item in sample_runs
            ],
            test_results=[
                {
                    "test_case_id": item.test_case_id,
                    "status": item.status,
                    "execution_time_ms": item.execution_time_ms,
                    "memory_kb": item.memory_kb,
                }
                for item in test_results
            ],
            event_bus=event_bus,
        )


@dramatiq.actor(queue_name=settings.judge_queue_name)
def validate_problem(*, problem_id: str) -> None:
    asyncio.run(_validate_problem(problem_id))


@dramatiq.actor(queue_name=settings.judge_queue_name)
def evaluate_submission(*, submission_id: str) -> None:
    asyncio.run(_evaluate_submission(submission_id))
