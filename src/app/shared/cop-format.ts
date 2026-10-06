/** Máximo de dígitos de un monto: el servidor admite hasta $ 999.999.999.999 */
export const MAX_COP_DIGITS = 12;

const COP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const COP_COMPACT = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** 1500000 → "$ 1.500.000" */
export function formatCop(value: number): string {
  return COP.format(value);
}

/** 1500000 → "$1,5 M" (ejes de gráficos) */
export function formatCopCompact(value: number): string {
  return COP_COMPACT.format(value);
}

/**
 * Convierte lo que escribió o pegó el usuario en pesos enteros.
 * Una coma seguida de 0–2 dígitos al final se toma como centavos y se descarta
 * ("1.500.000,50" → 1500000); el resto de símbolos se ignora ("1,500,000" → 1500000).
 */
export function parseCop(text: string): number | null {
  const withoutCents = text.replace(/,\d{0,2}\s*$/, '');
  const digits = withoutCents.replace(/\D/g, '').slice(0, MAX_COP_DIGITS);
  return digits ? Number(digits) : null;
}
