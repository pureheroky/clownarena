from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class RatingChange:
    old_rating: int
    new_rating: int

    @property
    def delta(self) -> int:
        return self.new_rating - self.old_rating


def expected_score(player_rating: int, opponent_rating: int) -> float:
    exponent = (opponent_rating - player_rating) / 400
    return 1 / (1 + 10**exponent)


def apply_elo(player_rating: int, opponent_rating: int, score: float, k_factor: int = 32) -> RatingChange:
    expected = expected_score(player_rating, opponent_rating)
    new_rating = round(player_rating + k_factor * (score - expected))
    return RatingChange(old_rating=player_rating, new_rating=new_rating)


def rate_match(
    player_one_rating: int,
    player_two_rating: int,
    player_one_score: float,
    *,
    k_factor: int = 32,
) -> tuple[RatingChange, RatingChange]:
    player_two_score = 1.0 - player_one_score
    return (
        apply_elo(player_one_rating, player_two_rating, player_one_score, k_factor=k_factor),
        apply_elo(player_two_rating, player_one_rating, player_two_score, k_factor=k_factor),
    )

