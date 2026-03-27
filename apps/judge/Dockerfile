FROM python:3.13-slim

WORKDIR /workspace

RUN apt-get update \
  && apt-get install -y --no-install-recommends docker.io docker-cli \
  && docker --version \
  && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml /workspace/pyproject.toml
COPY packages/backend /workspace/packages/backend
COPY apps /workspace/apps

RUN pip install --no-cache-dir .

CMD ["python", "-m", "dramatiq", "clownarena.judge.tasks"]
