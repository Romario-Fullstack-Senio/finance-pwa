import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { formatCopCompact } from '../cop-format';

let registered = false;

export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** '#3987e5' + 0.45 → '#3987e573' */
export function withAlpha(hex: string, alpha: number): string {
  return hex + Math.round(alpha * 255).toString(16).padStart(2, '0');
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/** Colores de las series, definidos una sola vez en src/styles.css */
export function seriesColors() {
  return {
    income: cssVar('--color-income'),
    fixed: cssVar('--color-fixed'),
    variable: cssVar('--color-variable'),
    savings: cssVar('--color-savings'),
    available: cssVar('--color-available'),
    surface: cssVar('--surface'),
    ink: cssVar('--ink'),
    muted: cssVar('--ink-muted'),
    hairline: cssVar('--hairline'),
  };
}

/** Eje de montos: sin borde, grilla tenue y valores compactos ($1,5 M) */
export function copAxis() {
  return {
    beginAtZero: true,
    border: { display: false },
    grid: { color: cssVar('--hairline') },
    ticks: { maxTicksLimit: 5, callback: (value: string | number) => formatCopCompact(Number(value)) },
  };
}

/** Registra solo lo que usan los gráficos de la app (tree-shaking) y aplica el tema oscuro */
export function setupCharts(): void {
  if (registered) return;
  registered = true;

  Chart.register(
    BarController,
    BarElement,
    LineController,
    LineElement,
    PointElement,
    CategoryScale,
    LinearScale,
    Tooltip,
  );

  const { ink, muted, hairline } = seriesColors();
  Chart.defaults.font.family = 'Manrope, ui-sans-serif, system-ui, sans-serif';
  Chart.defaults.font.size = 12;
  Chart.defaults.color = muted;
  Chart.defaults.borderColor = hairline;

  const tooltip = Chart.defaults.plugins.tooltip;
  tooltip.backgroundColor = cssVar('--page');
  tooltip.borderColor = 'rgba(148, 163, 184, 0.3)';
  tooltip.borderWidth = 1;
  tooltip.titleColor = ink;
  tooltip.bodyColor = ink;
  tooltip.footerColor = muted;
  tooltip.padding = 10;
  tooltip.cornerRadius = 8;
  tooltip.boxPadding = 4;
  tooltip.usePointStyle = true;
}
