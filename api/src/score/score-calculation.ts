export type ScoreLevel = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';

export function calculateScoreLevel(maxDaysLate: number): ScoreLevel {
  if (maxDaysLate <= 0) return 'GREEN';
  if (maxDaysLate <= 7) return 'YELLOW';
  if (maxDaysLate <= 15) return 'ORANGE';
  return 'RED';
}
