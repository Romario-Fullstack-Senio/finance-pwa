import { formatCop, formatCopCompact, parseCop } from './cop-format';

// Intl separa el símbolo con un espacio duro (U+00A0)
const nbsp = (text: string) => text.replace(/ /g, ' ');

describe('formatCop', () => {
  it('formatea pesos sin decimales con punto de miles', () => {
    expect(formatCop(1500000)).toBe(nbsp('$ 1.500.000'));
    expect(formatCop(0)).toBe(nbsp('$ 0'));
    expect(formatCop(-250000)).toBe(nbsp('-$ 250.000'));
  });

  it('redondea centavos', () => {
    expect(formatCop(1234.6)).toBe(nbsp('$ 1.235'));
  });

  it('tiene versión compacta para ejes', () => {
    expect(formatCopCompact(1500000)).toBe(nbsp('$1,5 M'));
  });
});

describe('parseCop', () => {
  it('devuelve null si no hay dígitos', () => {
    expect(parseCop('')).toBeNull();
    expect(parseCop('$ ')).toBeNull();
    expect(parseCop('abc')).toBeNull();
  });

  it('lee números escritos o pegados con formato', () => {
    expect(parseCop('1500000')).toBe(1500000);
    expect(parseCop(nbsp('$ 1.500.000'))).toBe(1500000);
    expect(parseCop('1,500,000')).toBe(1500000);
  });

  it('descarta los centavos después de la coma', () => {
    expect(parseCop('1.500.000,50')).toBe(1500000);
    expect(parseCop('1500,5')).toBe(1500);
    expect(parseCop('1.500,')).toBe(1500);
  });

  it('acepta máximo 12 dígitos', () => {
    expect(parseCop('9999999999999')).toBe(999999999999);
  });

  it('ignora ceros a la izquierda', () => {
    expect(parseCop('0005')).toBe(5);
  });
});
