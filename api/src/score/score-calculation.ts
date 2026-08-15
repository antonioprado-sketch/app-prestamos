export type ScoreLevel = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';

export function calculateScoreLevel(
  maxDaysLate: number,
  yellowMaxDays: number,
  orangeMaxDays: number,
): ScoreLevel {
  if (maxDaysLate <= 0) return 'GREEN';
  if (maxDaysLate <= yellowMaxDays) return 'YELLOW';
  if (maxDaysLate <= orangeMaxDays) return 'ORANGE';
  return 'RED';
}
