from __future__ import annotations

import re
from typing import Any, cast

from sqlalchemy import Select, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from clownarena.database import utcnow
from clownarena.enums import ProblemStatus, ReferenceSolutionStatus, TestKind
from clownarena.models import Duel
from clownarena.models import Problem, ProblemExample, ProblemVersion, ReferenceSolution, TestCase, User
from clownarena.schemas import DuelCatalogProblemResponse, DuelCatalogResponse, ProblemExampleResponse, ProblemResponse, ProblemSummaryResponse, ProblemVersionResponse, ReferenceSolutionResponse, TestCaseResponse
from clownarena.services.errors import ConflictError, ForbiddenError, NotFoundError


def slugify(value: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower()).strip("-")
    return cleaned or "problem"


async def _generate_unique_slug(session: AsyncSession, title: str, problem_id: str | None = None) -> str:
    base = slugify(title)
    slug = base
    suffix = 1
    while True:
        stmt: Select[tuple[Problem]] = select(Problem).where(Problem.slug == slug)
        if problem_id:
            stmt = stmt.where(Problem.id != problem_id)
        existing = await session.scalar(stmt)
        if existing is None:
            return slug
        suffix += 1
        slug = f"{base}-{suffix}"


async def create_problem(
    session: AsyncSession,
    *,
    author: User,
    title: str,
    description: str,
    input_spec: str,
    output_spec: str,
    constraints_text: str,
    difficulty: int,
    is_template_seeded: bool = False,
) -> ProblemResponse:
    problem = Problem(
        author_id=author.id,
        title=title,
        slug=await _generate_unique_slug(session, title),
        description=description,
        input_spec=input_spec,
        output_spec=output_spec,
        constraints_text=constraints_text,
        difficulty=difficulty,
        status=ProblemStatus.DRAFT,
        is_template_seeded=is_template_seeded,
    )
    session.add(problem)
    await session.commit()
    await session.refresh(problem)
    return await get_problem_response(session, problem, viewer_id=author.id)


async def _get_owned_problem(session: AsyncSession, *, problem_id: str, author_id: str) -> Problem:
    problem = await session.scalar(
        select(Problem).where(Problem.id == problem_id, Problem.author_id == author_id)
    )
    if problem is None:
        raise NotFoundError("Problem not found.")
    return problem


async def _get_reference_solution(
    session: AsyncSession,
    *,
    problem_id: str,
) -> ReferenceSolution | None:
    return await session.scalar(
        select(ReferenceSolution).where(ReferenceSolution.problem_id == problem_id)
    )


def _reference_needs_validation(reference: ReferenceSolution | None) -> bool:
    if reference is None:
        return False
    return reference.last_validated_at is None


async def _mark_reference_stale(
    session: AsyncSession,
    *,
    problem_id: str,
    message: str,
) -> None:
    reference = await _get_reference_solution(session, problem_id=problem_id)
    if reference is None:
        return
    reference.validation_status = ReferenceSolutionStatus.MISSING
    reference.validation_error = message
    reference.last_validated_at = None


def _enter_draft_if_needed(problem: Problem) -> None:
    if problem.status == ProblemStatus.VALIDATION:
        raise ConflictError("A check is already running for this task. Please wait for it to finish.")
    if problem.status == ProblemStatus.READY_FOR_DUEL:
        problem.status = ProblemStatus.DRAFT
        problem.is_public = False
        problem.is_duel_enabled = False
        problem.validation_notes = "You changed a published task. The live version stays untouched, and this working copy is back in draft mode."


async def update_problem(
    session: AsyncSession,
    *,
    author_id: str,
    problem_id: str,
    patch: dict[str, Any],
) -> ProblemResponse:
    problem = await _get_owned_problem(session, problem_id=problem_id, author_id=author_id)
    _enter_draft_if_needed(problem)

    if "title" in patch and patch["title"]:
        problem.title = patch["title"]
        problem.slug = await _generate_unique_slug(session, problem.title, problem.id)
    for field in ("description", "input_spec", "output_spec", "constraints_text", "difficulty"):
        if field in patch and patch[field] is not None:
            setattr(problem, field, patch[field])

    problem.validation_notes = None
    await _mark_reference_stale(
        session,
        problem_id=problem.id,
        message="You changed the task description. Check it again before publishing.",
    )
    await session.commit()
    await session.refresh(problem)
    return await get_problem_response(session, problem, viewer_id=author_id)


async def delete_problem(
    session: AsyncSession,
    *,
    author_id: str,
    problem_id: str,
) -> None:
    problem = await _get_owned_problem(session, problem_id=problem_id, author_id=author_id)
    duel = await session.scalar(select(Duel).where(Duel.problem_id == problem.id))
    if duel is not None:
        raise ConflictError("This problem has already been used in a duel and can no longer be deleted.")
    await session.delete(problem)
    await session.commit()


async def add_problem_example(
    session: AsyncSession,
    *,
    author_id: str,
    problem_id: str,
    payload: dict[str, Any],
) -> ProblemResponse:
    problem = await _get_owned_problem(session, problem_id=problem_id, author_id=author_id)
    _enter_draft_if_needed(problem)
    problem.validation_notes = None
    session.add(ProblemExample(problem_id=problem.id, **payload))
    await _mark_reference_stale(
        session,
        problem_id=problem.id,
        message="You changed the examples. Check the task again before publishing.",
    )
    await session.commit()
    return await get_problem_response(session, problem, viewer_id=author_id)


async def add_problem_test(
    session: AsyncSession,
    *,
    author_id: str,
    problem_id: str,
    payload: dict[str, Any],
) -> ProblemResponse:
    problem = await _get_owned_problem(session, problem_id=problem_id, author_id=author_id)
    _enter_draft_if_needed(problem)
    problem.validation_notes = None
    session.add(TestCase(problem_id=problem.id, **payload))
    await _mark_reference_stale(
        session,
        problem_id=problem.id,
        message="You changed the tests. Check the task again before publishing.",
    )
    await session.commit()
    return await get_problem_response(session, problem, viewer_id=author_id)


async def update_problem_example(
    session: AsyncSession,
    *,
    author_id: str,
    problem_id: str,
    example_id: str,
    payload: dict[str, Any],
) -> ProblemResponse:
    problem = await _get_owned_problem(session, problem_id=problem_id, author_id=author_id)
    _enter_draft_if_needed(problem)
    example = await session.scalar(
        select(ProblemExample).where(
            ProblemExample.id == example_id,
            ProblemExample.problem_id == problem.id,
        )
    )
    if example is None:
        raise NotFoundError("Example not found.")
    problem.validation_notes = None
    example.input_data = payload["input_data"]
    example.output_data = payload["output_data"]
    example.explanation = payload.get("explanation")
    example.order_index = payload["order_index"]
    await _mark_reference_stale(
        session,
        problem_id=problem.id,
        message="You changed the examples. Check the task again before publishing.",
    )
    await session.commit()
    return await get_problem_response(session, problem, viewer_id=author_id)


async def update_problem_test(
    session: AsyncSession,
    *,
    author_id: str,
    problem_id: str,
    test_id: str,
    payload: dict[str, Any],
) -> ProblemResponse:
    problem = await _get_owned_problem(session, problem_id=problem_id, author_id=author_id)
    _enter_draft_if_needed(problem)
    test = await session.scalar(
        select(TestCase).where(
            TestCase.id == test_id,
            TestCase.problem_id == problem.id,
        )
    )
    if test is None:
        raise NotFoundError("Test case not found.")
    problem.validation_notes = None
    test.input_data = payload["input_data"]
    test.expected_output = payload["expected_output"]
    test.kind = payload["kind"]
    test.weight = payload["weight"]
    test.order_index = payload["order_index"]
    await _mark_reference_stale(
        session,
        problem_id=problem.id,
        message="You changed the tests. Check the task again before publishing.",
    )
    await session.commit()
    return await get_problem_response(session, problem, viewer_id=author_id)


async def delete_problem_example(
    session: AsyncSession,
    *,
    author_id: str,
    problem_id: str,
    example_id: str,
) -> ProblemResponse:
    problem = await _get_owned_problem(session, problem_id=problem_id, author_id=author_id)
    _enter_draft_if_needed(problem)
    example = await session.scalar(
        select(ProblemExample).where(
            ProblemExample.id == example_id,
            ProblemExample.problem_id == problem.id,
        )
    )
    if example is None:
        raise NotFoundError("Example not found.")
    problem.validation_notes = None
    session.delete(example)
    await _mark_reference_stale(
        session,
        problem_id=problem.id,
        message="You changed the examples. Check the task again before publishing.",
    )
    await session.commit()
    return await get_problem_response(session, problem, viewer_id=author_id)


async def delete_problem_test(
    session: AsyncSession,
    *,
    author_id: str,
    problem_id: str,
    test_id: str,
) -> ProblemResponse:
    problem = await _get_owned_problem(session, problem_id=problem_id, author_id=author_id)
    _enter_draft_if_needed(problem)
    test = await session.scalar(
        select(TestCase).where(
            TestCase.id == test_id,
            TestCase.problem_id == problem.id,
        )
    )
    if test is None:
        raise NotFoundError("Test case not found.")
    problem.validation_notes = None
    session.delete(test)
    await _mark_reference_stale(
        session,
        problem_id=problem.id,
        message="You changed the tests. Check the task again before publishing.",
    )
    await session.commit()
    return await get_problem_response(session, problem, viewer_id=author_id)


async def upsert_reference_solution(
    session: AsyncSession,
    *,
    author_id: str,
    problem_id: str,
    language: str,
    code: str,
) -> ProblemResponse:
    problem = await _get_owned_problem(session, problem_id=problem_id, author_id=author_id)
    _enter_draft_if_needed(problem)
    existing = await _get_reference_solution(session, problem_id=problem.id)
    if existing:
        existing.language = language
        existing.code = code
        existing.validation_status = ReferenceSolutionStatus.MISSING
        existing.validation_error = "Code saved. Now run the check on this version."
        existing.last_validated_at = None
    else:
        session.add(
            ReferenceSolution(
                problem_id=problem.id,
                language=language,
                code=code,
                validation_status=ReferenceSolutionStatus.MISSING,
                validation_error="Code saved. Now run the check on this version.",
            )
        )
    problem.validation_notes = "Code saved. Run the check when you are ready to verify this version."
    await session.commit()
    return await get_problem_response(session, problem, viewer_id=author_id)


def _validation_notes_for_problem(test_cases: list[TestCase], reference_solution: ReferenceSolution | None) -> str | None:
    if len(test_cases) < 3:
        return "Add at least three tests before checking this task."
    if not any(test.kind == TestKind.HIDDEN for test in test_cases):
        return "Add at least one hidden test before checking this task."
    if reference_solution is None:
        return "Save a reference solution before checking this task."
    duplicates = {(test.input_data, test.expected_output) for test in test_cases}
    if len(duplicates) != len(test_cases):
        return "Two tests are identical. Remove duplicates before checking this task."
    return None


async def request_problem_validation(
    session: AsyncSession,
    *,
    author_id: str,
    problem_id: str,
    judge_gateway: Any,
) -> ProblemResponse:
    problem = await _get_owned_problem(session, problem_id=problem_id, author_id=author_id)
    _enter_draft_if_needed(problem)
    tests_result = await session.scalars(
        select(TestCase).where(TestCase.problem_id == problem.id).order_by(TestCase.order_index)
    )
    tests = list(tests_result.all())
    reference = await _get_reference_solution(session, problem_id=problem.id)
    notes = _validation_notes_for_problem(tests, reference)
    if notes:
        raise ConflictError(notes)
    assert reference is not None
    problem.status = ProblemStatus.VALIDATION
    problem.validation_notes = None
    reference.validation_status = ReferenceSolutionStatus.PENDING
    reference.validation_error = None
    await session.commit()
    await judge_gateway.enqueue_problem_validation(problem.id)
    return await get_problem_response(session, problem, viewer_id=author_id)


async def finalize_problem_validation(
    session: AsyncSession,
    *,
    problem_id: str,
    is_valid: bool,
    notes: str | None,
) -> Problem:
    problem = await session.get(Problem, problem_id)
    if problem is None:
        raise NotFoundError("Problem not found.")
    reference = await _get_reference_solution(session, problem_id=problem_id)
    if reference is None:
        raise ConflictError("Reference solution missing.")
    problem.status = ProblemStatus.READY_FOR_DUEL if is_valid else ProblemStatus.DISABLED
    problem.validation_notes = notes
    reference.validation_status = (
        ReferenceSolutionStatus.ACCEPTED if is_valid else ReferenceSolutionStatus.FAILED
    )
    reference.validation_error = None if is_valid else notes
    reference.last_validated_at = utcnow()
    await session.commit()
    await session.refresh(problem)
    return problem


async def publish_problem(
    session: AsyncSession,
    *,
    author_id: str,
    problem_id: str,
    is_public: bool,
    is_duel_enabled: bool,
) -> ProblemResponse:
    problem = await _get_owned_problem(session, problem_id=problem_id, author_id=author_id)
    if problem.is_template_seeded:
        raise ConflictError(
            "Built-in sample tasks are practice-only. Create your own version if you want to publish a duel problem."
        )
    if problem.status != ProblemStatus.READY_FOR_DUEL:
        raise ConflictError("This task is not ready yet. Run the check and wait for it to pass before publishing.")
    if not is_public or not is_duel_enabled:
        raise ConflictError("Tasks published for duels must stay public and available for duels.")

    examples_result = await session.scalars(
        select(ProblemExample).where(ProblemExample.problem_id == problem.id)
    )
    examples = list(examples_result.all())
    tests_result = await session.scalars(
        select(TestCase).where(TestCase.problem_id == problem.id).order_by(TestCase.order_index)
    )
    tests = list(tests_result.all())
    reference = await session.scalar(
        select(ReferenceSolution).where(ReferenceSolution.problem_id == problem.id)
    )
    if (
        reference is None
        or reference.validation_status != ReferenceSolutionStatus.ACCEPTED
        or _reference_needs_validation(reference)
    ):
        raise ConflictError("The reference solution still needs to pass the check before you can publish this task.")

    next_version = (
        await session.scalar(
            select(func.coalesce(func.max(ProblemVersion.version_number), 0) + 1).where(
                ProblemVersion.problem_id == problem.id
            )
        )
    ) or 1
    snapshot = {
        "title": problem.title,
        "description": problem.description,
        "input_spec": problem.input_spec,
        "output_spec": problem.output_spec,
        "constraints_text": problem.constraints_text,
        "difficulty": problem.difficulty,
        "examples": [
            {
                "input_data": example.input_data,
                "output_data": example.output_data,
                "explanation": example.explanation,
                "order_index": example.order_index,
            }
            for example in examples
        ],
        "tests": [
            {
                "id": test.id,
                "input_data": test.input_data,
                "expected_output": test.expected_output,
                "kind": test.kind.value,
                "weight": test.weight,
                "order_index": test.order_index,
            }
            for test in tests
        ],
        "reference_solution": {
            "language": reference.language,
            "code": reference.code,
        },
    }
    version = ProblemVersion(problem_id=problem.id, version_number=next_version, snapshot_json=snapshot)
    session.add(version)
    await session.flush()
    problem.active_version_id = version.id
    problem.is_public = is_public
    problem.is_duel_enabled = is_duel_enabled
    await session.commit()
    await session.refresh(problem)
    return await get_problem_response(session, problem, viewer_id=author_id)


async def get_problem_response(
    session: AsyncSession,
    problem: Problem,
    *,
    viewer_id: str | None,
) -> ProblemResponse:
    examples_result = await session.scalars(
        select(ProblemExample)
        .where(ProblemExample.problem_id == problem.id)
        .order_by(ProblemExample.order_index)
    )
    examples = list(examples_result.all())
    tests_result = await session.scalars(
        select(TestCase).where(TestCase.problem_id == problem.id).order_by(TestCase.order_index)
    )
    tests = list(tests_result.all())
    if viewer_id != problem.author_id:
        tests = [test for test in tests if test.kind == TestKind.SAMPLE]
    versions_result = await session.scalars(
        select(ProblemVersion)
        .where(ProblemVersion.problem_id == problem.id)
        .order_by(ProblemVersion.version_number.desc())
    )
    versions = list(versions_result.all())
    reference = await _get_reference_solution(session, problem_id=problem.id)
    if viewer_id != problem.author_id:
        reference = None

    # TODO: к нормальному виду привести потому что эт че т позор
    return ProblemResponse(
        id=problem.id,
        author_id=problem.author_id,
        title=problem.title,
        slug=problem.slug,
        description=problem.description,
        input_spec=problem.input_spec,
        output_spec=problem.output_spec,
        constraints_text=problem.constraints_text,
        difficulty=problem.difficulty,
        status=problem.status,
        is_public=problem.is_public,
        is_duel_enabled=problem.is_duel_enabled,
        is_template_seeded=problem.is_template_seeded,
        active_version_id=problem.active_version_id,
        validation_notes=problem.validation_notes,
        created_at=problem.created_at,
        updated_at=problem.updated_at,
        examples=[ProblemExampleResponse(
            id=example.id,
            input_data=example.input_data,
            output_data=example.output_data,
            explanation=example.explanation,
            order_index=example.order_index,
        ) for example in examples],
        tests=[TestCaseResponse(
            id=test.id,
            input_data=test.input_data,
            expected_output=test.expected_output,
            kind=test.kind,
            weight=test.weight,
            order_index=test.order_index,
        ) for test in tests],
        reference_solution=ReferenceSolutionResponse(
            id=reference.id,
            language=reference.language,
            code=reference.code,
            validation_status=reference.validation_status,
            needs_validation=_reference_needs_validation(reference),
            validation_error=reference.validation_error,
            last_validated_at=reference.last_validated_at,
            updated_at=reference.updated_at,
        ) if reference else None,
        versions=[ProblemVersionResponse(
            id=version.id,
            version_number=version.version_number,
            snapshot_json=version.snapshot_json,
            created_at=version.created_at,
        ) for version in versions],
    )


async def list_owned_problems(
    session: AsyncSession,
    *,
    author_id: str,
) -> list[ProblemSummaryResponse]:
    problems_result = await session.scalars(
        select(Problem)
        .where(Problem.author_id == author_id)
        .order_by(desc(Problem.updated_at))
    )
    problems = list(problems_result.all())

    items: list[ProblemSummaryResponse] = []
    for problem in problems:
        tests_count = (
            await session.scalar(
                select(func.count(TestCase.id)).where(TestCase.problem_id == problem.id)
            )
        ) or 0
        examples_count = (
            await session.scalar(
                select(func.count(ProblemExample.id)).where(ProblemExample.problem_id == problem.id)
            )
        ) or 0
        items.append(
            ProblemSummaryResponse(
                id=problem.id,
                title=problem.title,
                slug=problem.slug,
                difficulty=problem.difficulty,
                status=problem.status,
                is_template_seeded=problem.is_template_seeded,
                active_version_id=problem.active_version_id,
                validation_notes=problem.validation_notes,
                updated_at=problem.updated_at,
                tests_count=tests_count,
                examples_count=examples_count,
            )
        )
    return items


async def list_duel_catalog(
    session: AsyncSession,
    *,
    viewer_id: str,
) -> DuelCatalogResponse:
    result = await session.execute(
        select(Problem, User)
        .join(User, Problem.author_id == User.id)
        .where(
            Problem.status == ProblemStatus.READY_FOR_DUEL,
            Problem.is_public.is_(True),
            Problem.is_duel_enabled.is_(True),
            Problem.is_template_seeded.is_(False),
            Problem.active_version_id.is_not(None),
        )
        .order_by(desc(Problem.updated_at))
    )
    rows = list(result.all())
    rated_items: list[DuelCatalogProblemResponse] = []
    practice_items: list[DuelCatalogProblemResponse] = []
    for row in rows:
        problem, author = cast(tuple[Problem, User], tuple(row))
        if problem.active_version_id is None:
            continue
        item = DuelCatalogProblemResponse(
            id=problem.id,
            title=problem.title,
            slug=problem.slug,
            description=problem.description,
            difficulty=problem.difficulty,
            active_version_id=problem.active_version_id,
            author_id=author.id,
            author_username=author.username,
            updated_at=problem.updated_at,
        )
        if problem.author_id == viewer_id:
            practice_items.append(item)
        else:
            rated_items.append(item)
    return DuelCatalogResponse(rated=rated_items, practice=practice_items)


async def get_problem_by_id(
    session: AsyncSession,
    *,
    problem_id: str,
    viewer_id: str | None,
) -> ProblemResponse:
    problem = await session.get(Problem, problem_id)
    if problem is None:
        raise NotFoundError("Problem not found.")
    if not problem.is_public and viewer_id != problem.author_id:
        raise ForbiddenError("Problem is not public.")
    return await get_problem_response(session, problem, viewer_id=viewer_id)
