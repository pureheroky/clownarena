# Clown Arena

Clown Arena is a greenfield monorepo for rated 1v1 coding duels with user-generated problems,
immutable problem snapshots and `clown tokens` stakes.

## Workspace layout

- `apps/web`: Next.js frontend for auth, profile, problem forge, private duel room and match history.
- `apps/api`: FastAPI entrypoint exposing auth, wallet, problems, duels and WebSocket endpoints.
- `apps/judge`: Dramatiq worker entrypoint that validates reference solutions and evaluates duel submissions.
- `packages/backend/clownarena`: shared Python domain, SQLAlchemy models, service layer and judge sandbox.

Private rooms come in two modes:

- `rated`: uses another player's published task, reserves clown tokens and updates rating after the match.
- `practice`: uses one of your own published tasks and never changes rating or token balance.

## Local dev

1. Copy `.env.example` to `.env` and adjust credentials if needed.
2. Start dependencies with `docker compose up postgres redis`.
3. Install Python dependencies with `pip install -e .`.
4. Run migrations with `alembic upgrade head`.
5. Start API with `python -m uvicorn apps.api.main:app --reload --port 8000`.
6. Start judge with `python -m dramatiq clownarena.judge.tasks`.
7. Install frontend deps with `pnpm install` and run `pnpm --filter web dev`.

## Docker compose

Requirements:

- Docker Desktop running
- Host Docker socket available at `/var/run/docker.sock`

Run everything:

```bash
docker compose up --build
```

Open:

- Frontend: `http://localhost:3000`
- API docs: `http://localhost:8000/docs`

Stop and remove volumes:

```bash
docker compose down -v
```

## End-to-end smoke checks

The repository includes Playwright smoke coverage for auth, publish flow, practice rooms and rated rooms.

List the scenarios:

```bash
pnpm test:e2e --list
```

Run the suite against a running local stack:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 \
PLAYWRIGHT_API_URL=http://127.0.0.1:8000 \
pnpm test:e2e
```

## MVP defaults

- Signup bonus: `200` clown tokens
- Daily claim: `100` clown tokens every rolling 24 hours
- Allowed stake range: `25..500`
- Only Python is supported for reference solutions and duel submissions
- Rated private duels only allow public `ready_for_duel` problems not authored by either player
- Practice private duels only use your own published duel-ready problems and keep rating plus token changes at `0`
