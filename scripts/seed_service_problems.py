from __future__ import annotations

import argparse
import asyncio
import json
import secrets
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from clownarena.config import get_settings
from clownarena.database import SessionLocal, utcnow
from clownarena.enums import ProblemStatus, ReferenceSolutionStatus, TestKind
from clownarena.models import Problem, ProblemExample, ProblemVersion, ReferenceSolution, TestCase, User
from clownarena.security import hash_password
from clownarena.services.problems import slugify


DEFAULT_PROBLEMS_FILE = Path("docs/sample-problems.json")
DEFAULT_SERVICE_USERNAME = "system"
DEFAULT_SERVICE_EMAIL = "system@clownarena.local"


class SeedExample(BaseModel):
    input_data: str
    output_data: str
    explanation: str | None = None


class SeedTest(BaseModel):
    input_data: str
    expected_output: str
    kind: TestKind
    weight: int = Field(default=1, ge=1, le=100)


class SeedReferenceSolution(BaseModel):
    code: str = Field(min_length=1)
    language: str = Field(default="python", pattern="^python$")


class SeedProblem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=3, max_length=140)
    description: str = Field(min_length=10)
    input_spec: str = ""
    output_spec: str = ""
    constraints_text: str = ""
    difficulty: int = Field(default=1, ge=1, le=5)
    examples: list[SeedExample] = Field(default_factory=list)
    tests: list[SeedTest] = Field(default_factory=list)
    reference_solution: SeedReferenceSolution


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create basic problems under a dedicated service account."
    )
    parser.add_argument(
        "--file",
        type=Path,
        default=DEFAULT_PROBLEMS_FILE,
        help=f"Path to the JSON file with problem payloads. Default: {DEFAULT_PROBLEMS_FILE}",
    )
    parser.add_argument(
        "--username",
        default=DEFAULT_SERVICE_USERNAME,
        help=f"Service account username. Default: {DEFAULT_SERVICE_USERNAME}",
    )
    parser.add_argument(
        "--email",
        default=DEFAULT_SERVICE_EMAIL,
        help=f"Service account email. Default: {DEFAULT_SERVICE_EMAIL}",
    )
    parser.add_argument(
        "--password",
        default=None,
        help="Optional password for the service account. If omitted on first run, a random password is generated.",
    )
    parser.add_argument(
        "--draft-only",
        action="store_true",
        help="Create draft problems instead of immediately publishing them for duels.",
    )
    parser.add_argument(
        "--template-seeded",
        action="store_true",
        help="Mark created problems as template-seeded practice content.",
    )
    return parser.parse_args()


def load_problem_payloads(path: Path) -> list[SeedProblem]:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise SystemExit(f"Problem file not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise SystemExit(f"Problem file is not valid JSON: {path}: {exc}") from exc

    if not isinstance(raw, list):
        raise SystemExit(f"Problem file must contain a JSON array: {path}")

    try:
        return [SeedProblem.model_validate(item) for item in raw]
    except ValidationError as exc:
        raise SystemExit(f"Problem file validation failed:\n{exc}") from exc


async def generate_unique_slug(
    session: AsyncSession,
    title: str,
    reserved_slugs: set[str],
) -> str:
    base = slugify(title)
    slug = base
    suffix = 1
    while True:
        existing = await session.scalar(select(Problem.id).where(Problem.slug == slug))
        if existing is None and slug not in reserved_slugs:
            reserved_slugs.add(slug)
            return slug
        suffix += 1
        slug = f"{base}-{suffix}"


async def get_or_create_service_account(
    *,
    username: str,
    email: str,
    password: str | None,
) -> tuple[User, str | None, bool]:
    async with SessionLocal() as session:
        existing_by_username = await session.scalar(select(User).where(User.username == username))
        existing_by_email = await session.scalar(select(User).where(User.email == email))

        if existing_by_username and existing_by_email and existing_by_username.id != existing_by_email.id:
            raise SystemExit(
                "Service account lookup is ambiguous: the username and email belong to different users."
            )

        existing = existing_by_username or existing_by_email
        if existing is not None:
            return existing, None, False

        resolved_password = password or secrets.token_urlsafe(24)
        settings = get_settings()
        user = User(
            username=username,
            email=email,
            password_hash=hash_password(resolved_password),
            rating=settings.default_rating,
            clown_tokens_balance=0,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user, resolved_password, True


def build_snapshot_payload(problem: Problem, payload: SeedProblem) -> dict[str, object]:
    return {
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
                "order_index": index,
            }
            for index, example in enumerate(payload.examples)
        ],
        "tests": [
            {
                "input_data": test.input_data,
                "expected_output": test.expected_output,
                "kind": test.kind.value,
                "weight": test.weight,
                "order_index": index,
            }
            for index, test in enumerate(payload.tests)
        ],
        "reference_solution": {
            "language": payload.reference_solution.language,
            "code": payload.reference_solution.code,
        },
    }


async def seed_problems(
    *,
    service_account: User,
    problems: list[SeedProblem],
    draft_only: bool,
    template_seeded: bool,
) -> tuple[list[str], list[str]]:
    created_titles: list[str] = []
    skipped_titles: list[str] = []

    async with SessionLocal() as session:
        reserved_slugs: set[str] = set()
        for payload in problems:
            existing = await session.scalar(
                select(Problem).where(
                    Problem.author_id == service_account.id,
                    Problem.title == payload.title,
                )
            )
            if existing is not None:
                skipped_titles.append(payload.title)
                continue

            slug = await generate_unique_slug(session, payload.title, reserved_slugs)
            now = utcnow()
            should_publish = not draft_only
            reference_status = (
                ReferenceSolutionStatus.ACCEPTED if should_publish else ReferenceSolutionStatus.MISSING
            )
            validation_note = None if should_publish else "Reference solution is seeded and waiting for manual check."

            problem = Problem(
                author_id=service_account.id,
                title=payload.title,
                slug=slug,
                description=payload.description,
                input_spec=payload.input_spec,
                output_spec=payload.output_spec,
                constraints_text=payload.constraints_text,
                difficulty=payload.difficulty,
                status=ProblemStatus.READY_FOR_DUEL if should_publish else ProblemStatus.DRAFT,
                is_public=should_publish,
                is_duel_enabled=should_publish,
                is_template_seeded=template_seeded,
                validation_notes=validation_note,
            )
            session.add(problem)
            await session.flush()

            for index, example in enumerate(payload.examples):
                session.add(
                    ProblemExample(
                        problem_id=problem.id,
                        input_data=example.input_data,
                        output_data=example.output_data,
                        explanation=example.explanation,
                        order_index=index,
                    )
                )

            for index, test in enumerate(payload.tests):
                session.add(
                    TestCase(
                        problem_id=problem.id,
                        input_data=test.input_data,
                        expected_output=test.expected_output,
                        kind=test.kind,
                        weight=test.weight,
                        order_index=index,
                    )
                )

            session.add(
                ReferenceSolution(
                    problem_id=problem.id,
                    language=payload.reference_solution.language,
                    code=payload.reference_solution.code,
                    validation_status=reference_status,
                    validation_error=None if should_publish else validation_note,
                    last_validated_at=now if should_publish else None,
                )
            )

            if should_publish:
                version = ProblemVersion(
                    problem_id=problem.id,
                    version_number=1,
                    snapshot_json=build_snapshot_payload(problem, payload),
                )
                session.add(version)
                await session.flush()
                problem.active_version_id = version.id

            created_titles.append(payload.title)

        await session.commit()

    return created_titles, skipped_titles


async def async_main() -> int:
    args = parse_args()
    problems = load_problem_payloads(args.file)
    service_account, created_password, created_user = await get_or_create_service_account(
        username=args.username,
        email=args.email,
        password=args.password,
    )
    created_titles, skipped_titles = await seed_problems(
        service_account=service_account,
        problems=problems,
        draft_only=args.draft_only,
        template_seeded=args.template_seeded,
    )

    print(
        f"Service account: {service_account.username} <{service_account.email}>"
        f" ({'created' if created_user else 'reused'})"
    )
    if created_password:
        print(f"Generated password: {created_password}")
    print(f"Created problems: {len(created_titles)}")
    for title in created_titles:
        print(f"  + {title}")
    print(f"Skipped problems: {len(skipped_titles)}")
    for title in skipped_titles:
        print(f"  = {title}")
    return 0


def main() -> None:
    try:
        raise SystemExit(asyncio.run(async_main()))
    except KeyboardInterrupt:
        raise SystemExit(130) from None


if __name__ == "__main__":
    main()
