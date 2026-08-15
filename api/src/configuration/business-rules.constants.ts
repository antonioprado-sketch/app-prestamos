export const PENALTY_PER_DAY_KEY = 'penalty.per_day';
export const PENALTY_PER_DAY_DEFAULT = 50;

export const SCORE_YELLOW_MAX_DAYS_KEY = 'score.yellow_max_days';
export const SCORE_YELLOW_MAX_DAYS_DEFAULT = 7;

export const SCORE_ORANGE_MAX_DAYS_KEY = 'score.orange_max_days';
export const SCORE_ORANGE_MAX_DAYS_DEFAULT = 15;

export interface BusinessRules {
  penaltyPerDay: number;
  yellowMaxDays: number;
  orangeMaxDays: number;
}
