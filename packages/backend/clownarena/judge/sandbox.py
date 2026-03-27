from __future__ import annotations

import asyncio
import tempfile
import uuid
from dataclasses import dataclass
from pathlib import Path

from clownarena.config import get_settings
from clownarena.enums import SubmissionStatus


@dataclass(frozen=True)
class TestExecutionResult:
    test_case_id: str | None
    status: SubmissionStatus
    execution_time_ms: int | None
    memory_kb: int | None


@dataclass(frozen=True)
class VisibleSampleResult:
    input_data: str
    expected_output: str
    actual_output: str
    stderr: str
    status: SubmissionStatus
    execution_time_ms: int | None
    memory_kb: int | None


@dataclass(frozen=True)
class SandboxResult:
    status: SubmissionStatus
    stdout: str
    stderr: str
    execution_time_ms: int | None
    memory_kb: int | None


def normalize_output(value: str) -> str:
    return "\n".join(line.rstrip() for line in value.strip().splitlines()).strip()


class DockerSandbox:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.container_name = f"clownarena-judge-{uuid.uuid4().hex[:12]}"

    async def _run_cmd(
        self,
        args: list[str],
        *,
        stdin_text: str | None = None,
        timeout: int | None = None,
    ) -> SandboxResult:
        try:
            process = await asyncio.create_subprocess_exec(
                *args,
                stdin=asyncio.subprocess.PIPE if stdin_text is not None else None,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
        except FileNotFoundError as exc:
            return SandboxResult(
                status=SubmissionStatus.INTERNAL_ERROR,
                stdout="",
                stderr=f"Sandbox runtime is unavailable: {exc.filename} was not found.",
                execution_time_ms=None,
                memory_kb=None,
            )
        try:
            stdout, stderr = await asyncio.wait_for(
                process.communicate(stdin_text.encode("utf-8") if stdin_text is not None else None),
                timeout=timeout,
            )
        except TimeoutError:
            process.kill()
            await process.wait()
            return SandboxResult(
                status=SubmissionStatus.TIME_LIMIT_EXCEEDED,
                stdout="",
                stderr="Execution timed out.",
                execution_time_ms=timeout * 1000 if timeout else None,
                memory_kb=None,
            )

        status = SubmissionStatus.ACCEPTED if process.returncode == 0 else SubmissionStatus.RUNTIME_ERROR
        return SandboxResult(
            status=status,
            stdout=stdout.decode("utf-8"),
            stderr=stderr.decode("utf-8"),
            execution_time_ms=None,
            memory_kb=None,
        )

    async def compile_python(self, code_path: Path) -> SandboxResult:
        try:
            container = await self._prepare_container(code_path)
        except RuntimeError as exc:
            return SandboxResult(
                status=SubmissionStatus.INTERNAL_ERROR,
                stdout="",
                stderr=str(exc),
                execution_time_ms=None,
                memory_kb=None,
            )
        try:
            return await self._run_cmd(
                [
                    "docker",
                    "exec",
                    container,
                    "python",
                    "-m",
                    "py_compile",
                    "/tmp/solution.py",
                ],
                timeout=self.settings.judge_time_limit_sec,
            )
        finally:
            await self._cleanup_container(container)

    async def run_python(self, code_path: Path, stdin_text: str) -> SandboxResult:
        try:
            container = await self._prepare_container(code_path)
        except RuntimeError as exc:
            return SandboxResult(
                status=SubmissionStatus.INTERNAL_ERROR,
                stdout="",
                stderr=str(exc),
                execution_time_ms=None,
                memory_kb=None,
            )
        try:
            return await self._run_cmd(
                [
                    "docker",
                    "exec",
                    "-i",
                    container,
                    "python",
                    "/tmp/solution.py",
                ],
                stdin_text=stdin_text,
                timeout=self.settings.judge_time_limit_sec,
            )
        finally:
            await self._cleanup_container(container)

    async def _prepare_container(self, code_path: Path) -> str:
        container = self.container_name
        code = code_path.read_text(encoding="utf-8")
        create_result = await self._run_cmd(
            [
                "docker",
                "create",
                "--name",
                container,
                "--network",
                "none",
                "--read-only",
                "--tmpfs",
                "/tmp:rw,nosuid,nodev,size=64m",
                "-m",
                f"{self.settings.judge_memory_mb}m",
                "--cpus",
                "1",
                self.settings.judge_python_image,
                "sleep",
                "infinity",
            ],
            timeout=self.settings.judge_time_limit_sec,
        )
        if create_result.status != SubmissionStatus.ACCEPTED:
            raise RuntimeError(create_result.stderr or "Failed to create sandbox container.")

        start_result = await self._run_cmd(
            [
                "docker",
                "start",
                container,
            ],
            timeout=self.settings.judge_time_limit_sec,
        )
        if start_result.status != SubmissionStatus.ACCEPTED:
            raise RuntimeError(start_result.stderr or "Failed to start sandbox container.")

        write_result = await self._run_cmd(
            [
                "docker",
                "exec",
                "-i",
                container,
                "sh",
                "-lc",
                "cat > /tmp/solution.py",
            ],
            stdin_text=code,
            timeout=self.settings.judge_time_limit_sec,
        )
        if write_result.status != SubmissionStatus.ACCEPTED:
            raise RuntimeError(write_result.stderr or "Failed to write source into sandbox container.")
        return container

    async def _cleanup_container(self, container: str) -> None:
        await self._run_cmd(
            [
                "docker",
                "rm",
                "-f",
                container,
            ],
            timeout=self.settings.judge_time_limit_sec,
        )

    async def evaluate(self, code: str, tests: list[dict]) -> tuple[SandboxResult, list[TestExecutionResult], int, int]:
        with tempfile.TemporaryDirectory() as tmpdir:
            code_path = Path(tmpdir) / "solution.py"
            code_path.write_text(code, encoding="utf-8")

            compile_result = await self.compile_python(code_path)
            if compile_result.status == SubmissionStatus.INTERNAL_ERROR:
                return (
                    compile_result,
                    [],
                    0,
                    0,
                )
            if compile_result.status != SubmissionStatus.ACCEPTED:
                return (
                    SandboxResult(
                        status=SubmissionStatus.COMPILE_ERROR,
                        stdout=compile_result.stdout,
                        stderr=compile_result.stderr,
                        execution_time_ms=compile_result.execution_time_ms,
                        memory_kb=compile_result.memory_kb,
                    ),
                    [],
                    0,
                    0,
                )

            test_results: list[TestExecutionResult] = []
            passed_tests = 0
            passed_weight = 0
            last_run: SandboxResult | None = None
            for test in tests:
                last_run = await self.run_python(code_path, test["input_data"])
                expected = normalize_output(test["expected_output"])
                actual = normalize_output(last_run.stdout)
                if last_run.status == SubmissionStatus.TIME_LIMIT_EXCEEDED:
                    status = SubmissionStatus.TIME_LIMIT_EXCEEDED
                elif last_run.status == SubmissionStatus.INTERNAL_ERROR:
                    status = SubmissionStatus.INTERNAL_ERROR
                elif last_run.status != SubmissionStatus.ACCEPTED:
                    status = SubmissionStatus.RUNTIME_ERROR
                elif actual == expected:
                    status = SubmissionStatus.ACCEPTED
                    passed_tests += 1
                    passed_weight += int(test["weight"])
                else:
                    status = SubmissionStatus.WRONG_ANSWER
                test_results.append(
                    TestExecutionResult(
                        test_case_id=test.get("id"),
                        status=status,
                        execution_time_ms=last_run.execution_time_ms,
                        memory_kb=last_run.memory_kb,
                    )
                )
                if status != SubmissionStatus.ACCEPTED:
                    return (
                        SandboxResult(
                            status=status,
                            stdout=last_run.stdout,
                            stderr=last_run.stderr,
                            execution_time_ms=last_run.execution_time_ms,
                            memory_kb=last_run.memory_kb,
                        ),
                        test_results,
                        passed_tests,
                        passed_weight,
                    )

            return (
                SandboxResult(
                    status=SubmissionStatus.ACCEPTED,
                    stdout=last_run.stdout if last_run else "",
                    stderr=last_run.stderr if last_run else "",
                    execution_time_ms=last_run.execution_time_ms if last_run else None,
                    memory_kb=last_run.memory_kb if last_run else None,
                ),
                test_results,
                passed_tests,
                passed_weight,
            )

    async def inspect_visible_samples(self, code: str, tests: list[dict]) -> list[VisibleSampleResult]:
        if not tests:
            return []

        with tempfile.TemporaryDirectory() as tmpdir:
            code_path = Path(tmpdir) / "solution.py"
            code_path.write_text(code, encoding="utf-8")

            compile_result = await self.compile_python(code_path)
            if compile_result.status != SubmissionStatus.ACCEPTED:
                return []

            runs: list[VisibleSampleResult] = []
            for test in tests:
                run = await self.run_python(code_path, str(test["input_data"]))
                expected = normalize_output(str(test["expected_output"]))
                actual = normalize_output(run.stdout)
                if run.status == SubmissionStatus.TIME_LIMIT_EXCEEDED:
                    status = SubmissionStatus.TIME_LIMIT_EXCEEDED
                elif run.status == SubmissionStatus.INTERNAL_ERROR:
                    status = SubmissionStatus.INTERNAL_ERROR
                elif run.status != SubmissionStatus.ACCEPTED:
                    status = SubmissionStatus.RUNTIME_ERROR
                elif actual == expected:
                    status = SubmissionStatus.ACCEPTED
                else:
                    status = SubmissionStatus.WRONG_ANSWER
                runs.append(
                    VisibleSampleResult(
                        input_data=str(test["input_data"]),
                        expected_output=str(test["expected_output"]),
                        actual_output=run.stdout,
                        stderr=run.stderr,
                        status=status,
                        execution_time_ms=run.execution_time_ms,
                        memory_kb=run.memory_kb,
                    )
                )
            return runs
