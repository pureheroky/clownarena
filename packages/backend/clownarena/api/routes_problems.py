from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from clownarena.api.deps import get_current_user, get_judge_gateway
from clownarena.database import get_db
from clownarena.schemas import (
    DuelCatalogResponse,
    ProblemCreateRequest,
    ProblemExampleCreateRequest,
    ProblemExampleUpdateRequest,
    ProblemPublishRequest,
    ProblemResponse,
    ProblemSummaryResponse,
    ProblemUpdateRequest,
    ReferenceSolutionRequest,
    TestCaseCreateRequest,
    TestCaseUpdateRequest,
)
from clownarena.services.judge import JudgeGateway
from clownarena.services.problems import (
    add_problem_example,
    add_problem_test,
    create_problem,
    delete_problem,
    delete_problem_example,
    delete_problem_test,
    get_problem_by_id,
    list_duel_catalog,
    list_owned_problems,
    publish_problem,
    request_problem_validation,
    update_problem,
    update_problem_example,
    update_problem_test,
    upsert_reference_solution,
)


router = APIRouter(prefix="/problems", tags=["problems"])


@router.post("", response_model=ProblemResponse)
async def create_problem_route(
    payload: ProblemCreateRequest,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> ProblemResponse:
    return await create_problem(
        session,
        author=user,
        title=payload.title,
        description=payload.description,
        input_spec=payload.input_spec,
        output_spec=payload.output_spec,
        constraints_text=payload.constraints_text,
        difficulty=payload.difficulty,
    )


@router.patch("/{problem_id}", response_model=ProblemResponse)
async def update_problem_route(
    problem_id: str,
    payload: ProblemUpdateRequest,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> ProblemResponse:
    return await update_problem(
        session,
        author_id=user.id,
        problem_id=problem_id,
        patch=payload.model_dump(exclude_none=True),
    )


@router.delete("/{problem_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_problem_route(
    problem_id: str,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Response:
    await delete_problem(session, author_id=user.id, problem_id=problem_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{problem_id}/examples", response_model=ProblemResponse)
async def add_example_route(
    problem_id: str,
    payload: ProblemExampleCreateRequest,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> ProblemResponse:
    return await add_problem_example(
        session,
        author_id=user.id,
        problem_id=problem_id,
        payload=payload.model_dump(),
    )


@router.patch("/{problem_id}/examples/{example_id}", response_model=ProblemResponse)
async def update_example_route(
    problem_id: str,
    example_id: str,
    payload: ProblemExampleUpdateRequest,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> ProblemResponse:
    return await update_problem_example(
        session,
        author_id=user.id,
        problem_id=problem_id,
        example_id=example_id,
        payload=payload.model_dump(),
    )


@router.delete("/{problem_id}/examples/{example_id}", response_model=ProblemResponse)
async def delete_example_route(
    problem_id: str,
    example_id: str,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> ProblemResponse:
    return await delete_problem_example(
        session,
        author_id=user.id,
        problem_id=problem_id,
        example_id=example_id,
    )


@router.post("/{problem_id}/tests", response_model=ProblemResponse)
async def add_test_route(
    problem_id: str,
    payload: TestCaseCreateRequest,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> ProblemResponse:
    return await add_problem_test(
        session,
        author_id=user.id,
        problem_id=problem_id,
        payload=payload.model_dump(),
    )


@router.patch("/{problem_id}/tests/{test_id}", response_model=ProblemResponse)
async def update_test_route(
    problem_id: str,
    test_id: str,
    payload: TestCaseUpdateRequest,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> ProblemResponse:
    return await update_problem_test(
        session,
        author_id=user.id,
        problem_id=problem_id,
        test_id=test_id,
        payload=payload.model_dump(),
    )


@router.delete("/{problem_id}/tests/{test_id}", response_model=ProblemResponse)
async def delete_test_route(
    problem_id: str,
    test_id: str,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> ProblemResponse:
    return await delete_problem_test(
        session,
        author_id=user.id,
        problem_id=problem_id,
        test_id=test_id,
    )


@router.put("/{problem_id}/reference-solution", response_model=ProblemResponse)
async def upsert_reference_solution_route(
    problem_id: str,
    payload: ReferenceSolutionRequest,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> ProblemResponse:
    return await upsert_reference_solution(
        session,
        author_id=user.id,
        problem_id=problem_id,
        language=payload.language,
        code=payload.code,
    )


@router.post("/{problem_id}/validate", response_model=ProblemResponse)
async def validate_problem_route(
    problem_id: str,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
    judge_gateway: JudgeGateway = Depends(get_judge_gateway),
) -> ProblemResponse:
    return await request_problem_validation(
        session,
        author_id=user.id,
        problem_id=problem_id,
        judge_gateway=judge_gateway,
    )


@router.post("/{problem_id}/publish", response_model=ProblemResponse)
async def publish_problem_route(
    problem_id: str,
    payload: ProblemPublishRequest,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> ProblemResponse:
    return await publish_problem(
        session,
        author_id=user.id,
        problem_id=problem_id,
        is_public=payload.is_public,
        is_duel_enabled=payload.is_duel_enabled,
    )


@router.get("/mine", response_model=list[ProblemSummaryResponse])
async def list_my_problems_route(
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[ProblemSummaryResponse]:
    return await list_owned_problems(session, author_id=user.id)


@router.get("/duel-catalog", response_model=DuelCatalogResponse)
async def duel_catalog_route(
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> DuelCatalogResponse:
    return await list_duel_catalog(session, viewer_id=user.id)


@router.get("/{problem_id}", response_model=ProblemResponse)
async def get_problem_route(
    problem_id: str,
    session: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
) -> ProblemResponse:
    return await get_problem_by_id(session, problem_id=problem_id, viewer_id=user.id)
