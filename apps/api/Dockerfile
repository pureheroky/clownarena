FROM python:3.13-slim

WORKDIR /workspace

COPY pyproject.toml /workspace/pyproject.toml
COPY packages/backend /workspace/packages/backend
COPY apps /workspace/apps
COPY alembic /workspace/alembic
COPY alembic.ini /workspace/alembic.ini
COPY scripts /workspace/scripts
COPY docs /workspace/docs

RUN pip install --no-cache-dir .

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "apps.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
