# Production Deployment: Vercel + Google Cloud

This repository can be deployed to production with the following split:

- `apps/web` on Vercel
- `api` on Google Cloud Run
- PostgreSQL on Cloud SQL
- Redis on Memorystore for Redis
- `judge` on a VM or Kubernetes, not on Cloud Run

## Why the judge is separate

The judge currently shells out to `docker` and launches nested sandbox containers through the host Docker runtime.
That is a hard requirement of `packages/backend/clownarena/judge/sandbox.py`.

Because of that, the judge should run on infrastructure where Docker is available to the container or process:

- a Compute Engine VM
- GKE
- another container host where mounting `/var/run/docker.sock` is acceptable

Do not plan to run the current judge on Cloud Run.

## Recommended topology

Use one apex domain and two subdomains if possible:

- `app.example.com` for Vercel
- `api.example.com` for Cloud Run

This keeps browser auth simpler because the frontend and API stay on the same site.

If you use platform domains such as `*.vercel.app` and `*.run.app`, set:

- `SESSION_COOKIE_SECURE=true`
- `SESSION_COOKIE_SAMESITE=none`

If you use same-site custom subdomains, you can keep:

- `SESSION_COOKIE_SECURE=true`
- `SESSION_COOKIE_SAMESITE=lax`

## Vercel configuration

Create the Vercel project from `apps/web`.

Production environment variables:

```bash
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_WS_URL=wss://api.example.com
```

Preview environment variables can point to the same API if you want previews to stay functional.

## Cloud Run API configuration

Build and deploy the `apps/api/Dockerfile` image.
The image now uses the Cloud Run `PORT` environment variable automatically through the `clownarena-api` entrypoint.

Set at least these environment variables on the API service:

```bash
ENVIRONMENT=production
SECRET_KEY=replace-with-a-long-random-secret
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@PRIVATE_IP:5432/clownarena
ASYNC_DATABASE_URL=postgresql+asyncpg://USER:PASSWORD@PRIVATE_IP:5432/clownarena
REDIS_URL=redis://REDIS_PRIVATE_IP:6379/0
CORS_ORIGINS=https://app.example.com
CORS_ORIGIN_REGEX=^https://.*\.vercel\.app$
SESSION_COOKIE_NAME=clownarena_session
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_DOMAIN=
SESSION_COOKIE_SAMESITE=lax
DB_POOL_SIZE=5
DB_MAX_OVERFLOW=10
DB_POOL_TIMEOUT=30
DB_POOL_RECYCLE=1800
```

Notes:

- If you are not using custom subdomains, change `SESSION_COOKIE_SAMESITE` to `none`.
- `CORS_ORIGIN_REGEX` is useful for Vercel preview URLs.
- Keep Cloud Run `max instances` aligned with your Postgres connection budget.

## Redis and database connectivity

The current code expects plain DSNs with host and port.
The lowest-friction production setup is:

- Cloud SQL with private IP
- Memorystore with private IP
- Cloud Run API configured with VPC egress
- judge VM placed in the same VPC

## Judge deployment

Run the existing judge container on a VM or another Docker-capable host.
It needs:

```bash
ENVIRONMENT=production
SECRET_KEY=replace-with-a-long-random-secret
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@PRIVATE_IP:5432/clownarena
ASYNC_DATABASE_URL=postgresql+asyncpg://USER:PASSWORD@PRIVATE_IP:5432/clownarena
REDIS_URL=redis://REDIS_PRIVATE_IP:6379/0
```

The host must expose `/var/run/docker.sock` to the judge container if you keep the current sandbox implementation.

## Health checks

The API now exposes:

- `/health` for a basic liveness check
- `/health/ready` for database and Redis readiness

Use `/health/ready` for production probes where supported.

## WebSockets

The frontend now supports:

- a dedicated `NEXT_PUBLIC_WS_URL`
- automatic reconnect after disconnects

This matters on Cloud Run because WebSocket connections still obey request timeout limits.

## One-time setup checklist

1. Provision Cloud SQL and Memorystore in the same region as Cloud Run.
2. Deploy the API to Cloud Run with VPC egress and the env vars above.
3. Deploy the judge on a VM or GKE node pool with Docker access.
4. Run `alembic upgrade head` against production before opening traffic.
5. Set the Vercel env vars and deploy `apps/web`.
6. Confirm login, a duel WebSocket connection, and a judge execution in staging before production cutover.
