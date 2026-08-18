export const PENALTY_PER_DAY_KEY = 'penalty.per_day';
export const PENALTY_PER_DAY_DEFAULT = 50;

export const SCORE_YELLOW_MAX_DAYS_KEY = 'score.yellow_max_days';
export const SCORE_YELLOW_MAX_DAYS_DEFAULT = 7;

export const SCORE_ORANGE_MAX_DAYS_KEY = 'score.orange_max_days';
export const SCORE_ORANGE_MAX_DAYS_DEFAULT = 15;

// Tope de préstamo según nivel de score del cliente (sin préstamo vigente).
// green_max_amount puede ser null = sin tope (hasta el máximo de la app).
export const SCORE_GREEN_MAX_AMOUNT_KEY = 'score.green_max_amount';
export const SCORE_GREEN_MAX_AMOUNT_DEFAULT = null;

export const SCORE_YELLOW_MAX_AMOUNT_KEY = 'score.yellow_max_amount';
export const SCORE_YELLOW_MAX_AMOUNT_DEFAULT = 3000;

export const SCORE_ORANGE_MAX_AMOUNT_KEY = 'score.orange_max_amount';
export const SCORE_ORANGE_MAX_AMOUNT_DEFAULT = 2000;

export const SCORE_RED_MAX_AMOUNT_KEY = 'score.red_max_amount';
export const SCORE_RED_MAX_AMOUNT_DEFAULT = 1000;

export interface BusinessRules {
  penaltyPerDay: number;
  yellowMaxDays: number;
  orangeMaxDays: number;
  greenMaxAmount: number | null;
  yellowMaxAmount: number;
  orangeMaxAmount: number;
  redMaxAmount: number;
}
