import {
  currentMonthKey,
  formatMonthLabel,
  monthRange,
  monthsBetween,
  shiftMonth,
  todayIso,
} from './month';

describe('month utils', () => {
  it('usa la fecha local, no UTC', () => {
    // 31 de octubre, 9 p. m. en Bogotá ya es 1 de noviembre en UTC
    const lateNight = new Date(2026, 9, 31, 21, 0);
    expect(todayIso(lateNight)).toBe('2026-10-31');
    expect(currentMonthKey(lateNight)).toBe('2026-10');
  });

  it('se mueve entre meses cruzando el año', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-05', -17)).toBe('2024-12');
  });

  it('cuenta meses entre dos fechas', () => {
    expect(monthsBetween('2025-11', '2026-02')).toBe(3);
    expect(monthsBetween('2026-02', '2025-11')).toBe(-3);
  });

  it('arma rangos continuos que terminan en el mes dado', () => {
    expect(monthRange('2026-02', 4)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });

  it('nombra los meses en español', () => {
    expect(formatMonthLabel('2026-09')).toBe('Septiembre 2026');
    expect(formatMonthLabel('2026-01', 'short')).toBe('Ene 26');
  });
});
