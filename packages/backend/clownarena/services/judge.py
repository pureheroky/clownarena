from __future__ import annotations

from clownarena.judge.tasks import evaluate_submission, validate_problem


class JudgeGateway:
    async def enqueue_problem_validation(self, problem_id: str) -> None:
        validate_problem.send(problem_id=problem_id)

    async def enqueue_submission_evaluation(self, submission_id: str) -> None:
        evaluate_submission.send(submission_id=submission_id)

