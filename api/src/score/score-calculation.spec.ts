import { calculateScoreLevel } from './score-calculation';

describe('calculateScoreLevel', () => {
  it('GREEN cuando no hay días de atraso', () => {
    expect(calculateScoreLevel(0)).toBe('GREEN');
  });

  it('YELLOW entre 1 y 7 días de atraso', () => {
    expect(calculateScoreLevel(1)).toBe('YELLOW');
    expect(calculateScoreLevel(7)).toBe('YELLOW');
  });

  it('ORANGE entre 8 y 15 días de atraso', () => {
    expect(calculateScoreLevel(8)).toBe('ORANGE');
    expect(calculateScoreLevel(15)).toBe('ORANGE');
  });

  it('RED con más de 15 días de atraso', () => {
    expect(calculateScoreLevel(16)).toBe('RED');
    expect(calculateScoreLevel(100)).toBe('RED');
  });
});
