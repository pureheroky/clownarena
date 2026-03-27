from __future__ import annotations

import unittest
from datetime import datetime, timedelta, timezone

from clownarena.domain.duel_rules import ParticipantProgress, determine_winner, penalty_for_status
from clownarena.domain.rating import expected_score, rate_match
from clownarena.domain.wallet import can_claim_daily, reserve_stake
from clownarena.enums import SubmissionStatus


UTC = timezone.utc


class RatingRulesTest(unittest.TestCase):
    def test_expected_score_is_symmetric(self) -> None:
        stronger = expected_score(1400, 1200)
        weaker = expected_score(1200, 1400)
        self.assertAlmostEqual(stronger + weaker, 1.0, places=5)

    def test_winner_gains_rating(self) -> None:
        winner, loser = rate_match(1200, 1200, 1.0)
        self.assertGreater(winner.delta, 0)
        self.assertLess(loser.delta, 0)


class WalletRulesTest(unittest.TestCase):
    def test_daily_claim_respects_24_hour_window(self) -> None:
        now = datetime.now(UTC)
        self.assertFalse(can_claim_daily(now, now + timedelta(hours=23)))
        self.assertTrue(can_claim_daily(now, now + timedelta(hours=24)))

    def test_reserve_stake_reduces_balance(self) -> None:
        self.assertEqual(reserve_stake(200, 50), 150)


class DuelRulesTest(unittest.TestCase):
    def test_accepted_submission_beats_weight(self) -> None:
        now = datetime.now(UTC)
        first = ParticipantProgress(user_id="u1", accepted_at=now + timedelta(seconds=5), best_passed_weight=5)
        second = ParticipantProgress(user_id="u2", accepted_at=None, best_passed_weight=10)
        decision = determine_winner(first, second)
        self.assertEqual(decision.winner_id, "u1")

    def test_weight_breaks_timeout_tie(self) -> None:
        first = ParticipantProgress(user_id="u1", best_passed_weight=7, penalty_seconds=20)
        second = ParticipantProgress(user_id="u2", best_passed_weight=5, penalty_seconds=0)
        decision = determine_winner(first, second)
        self.assertEqual(decision.winner_id, "u1")

    def test_penalty_applies_on_failure(self) -> None:
        self.assertEqual(
            penalty_for_status(SubmissionStatus.WRONG_ANSWER, penalty_seconds=20),
            20,
        )
        self.assertEqual(
            penalty_for_status(SubmissionStatus.ACCEPTED, penalty_seconds=20),
            0,
        )


if __name__ == "__main__":
    unittest.main()

