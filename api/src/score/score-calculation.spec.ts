import { calculateScoreLevel } from './score-calculation';

const YELLOW_MAX_DAYS = 7;
const ORANGE_MAX_DAYS = 15;

describe('calculateScoreLevel', () => {
  it('GREEN cuando no hay días de atraso', () => {
    expect(calculateScoreLevel(0, YELLOW_MAX_DAYS, ORANGE_MAX_DAYS)).toBe(
      'GREEN',
    );
  });

  it('YELLOW entre 1 y el umbral configurado', () => {
    expect(calculateScoreLevel(1, YELLOW_MAX_DAYS, ORANGE_MAX_DAYS)).toBe(
      'YELLOW',
    );
    expect(calculateScoreLevel(7, YELLOW_MAX_DAYS, ORANGE_MAX_DAYS)).toBe(
      'YELLOW',
    );
  });

  it('ORANGE entre el umbral amarillo y el naranja configurados', () => {
    expect(calculateScoreLevel(8, YELLOW_MAX_DAYS, ORANGE_MAX_DAYS)).toBe(
      'ORANGE',
    );
    expect(calculateScoreLevel(15, YELLOW_MAX_DAYS, ORANGE_MAX_DAYS)).toBe(
      'ORANGE',
    );
  });

  it('RED por encima del umbral naranja configurado', () => {
    expect(calculateScoreLevel(16, YELLOW_MAX_DAYS, ORANGE_MAX_DAYS)).toBe(
      'RED',
    );
    expect(calculateScoreLevel(100, YELLOW_MAX_DAYS, ORANGE_MAX_DAYS)).toBe(
      'RED',
    );
  });

  it('respeta umbrales configurados distintos de los valores por defecto', () => {
    expect(calculateScoreLevel(3, 2, 5)).toBe('ORANGE');
    expect(calculateScoreLevel(6, 2, 5)).toBe('RED');
  });
});
