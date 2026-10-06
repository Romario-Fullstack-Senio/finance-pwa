import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ChartConfiguration } from 'chart.js';
import { FinanceService } from '../../core/services/finance.service';
import { MonthSummary } from '../../core/utils/finance-stats';
import { formatMonthLabel } from '../../core/utils/month';
import { formatCop } from '../../shared/cop-format';
import { CopCurrencyPipe } from '../../shared/cop-currency.pipe';
import { ChartComponent } from '../../shared/charts/chart.component';
import { copAxis, seriesColors, withAlpha } from '../../shared/charts/chart-setup';

type SeriesKey = 'income' | 'fixed' | 'variable' | 'saved';

const SERIES: { key: SeriesKey; label: string; css: string; stack: string }[] = [
  { key: 'income', label: 'Ingresos', css: 'var(--color-income)', stack: 'income' },
  { key: 'fixed', label: 'Gastos fijos', css: 'var(--color-fixed)', stack: 'uses' },
  { key: 'variable', label: 'Gastos variables', css: 'var(--color-variable)', stack: 'uses' },
  { key: 'saved', label: 'Ahorro', css: 'var(--color-savings)', stack: 'uses' },
];

@Component({
  selector: 'app-income-expense-chart',
  imports: [ChartComponent, CopCurrencyPipe],
  templateUrl: './income-expense-chart.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IncomeExpenseChartComponent {
  private readonly financeService = inject(FinanceService);

  readonly history = this.financeService.history;
  readonly series = SERIES;
  readonly hasData = computed(() => this.history().some((m) => m.income || m.expense || m.saved));
  readonly monthLabel = (month: string) => formatMonthLabel(month);

  readonly label = computed(() => {
    const months = this.history();
    return `Barras por mes de ${formatMonthLabel(months[0].month)} a ${formatMonthLabel(
      months[months.length - 1].month,
    )}: ingresos junto a gastos fijos, gastos variables y ahorro apilados. La tabla siguiente tiene los valores.`;
  });

  readonly config = computed<ChartConfiguration<'bar'>>(() => {
    const months = this.history();
    const selected = this.financeService.selectedMonth();
    const colors = seriesColors();
    const colorOf: Record<SeriesKey, string> = {
      income: colors.income,
      fixed: colors.fixed,
      variable: colors.variable,
      saved: colors.savings,
    };
    // El mes seleccionado va a color pleno; el resto, atenuado
    const fade = (color: string) =>
      months.map((m) => (m.month === selected ? color : withAlpha(color, 0.4)));

    return {
      type: 'bar',
      data: {
        labels: months.map((m) => formatMonthLabel(m.month, 'short')),
        datasets: SERIES.map((series) => ({
          label: series.label,
          data: months.map((m: MonthSummary) => m[series.key]),
          stack: series.stack,
          backgroundColor: fade(colorOf[series.key]),
          hoverBackgroundColor: colorOf[series.key],
          // Separación de 2px entre segmentos apilados, con el color de la superficie
          borderColor: colors.surface,
          borderWidth: { top: 2 },
          borderRadius: 4,
          maxBarThickness: 22,
        })),
      },
      options: {
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { stacked: true, grid: { display: false }, border: { color: colors.hairline } },
          y: { ...copAxis(), stacked: true },
        },
        plugins: {
          tooltip: {
            callbacks: {
              title: (items) => formatMonthLabel(months[items[0].dataIndex].month),
              label: (item) => `${item.dataset.label}: ${formatCop(item.parsed.y ?? 0)}`,
              footer: (items) => `Disponible: ${formatCop(months[items[0].dataIndex].available)}`,
            },
          },
        },
        onClick: (_event, elements) => {
          const element = elements[0];
          if (element) this.financeService.setSelectedMonth(months[element.index].month);
        },
        onHover: (event, elements) => {
          const target = event.native?.target as HTMLElement | undefined;
          if (target) target.style.cursor = elements.length ? 'pointer' : 'default';
        },
      },
    };
  });

  select(month: string): void {
    this.financeService.setSelectedMonth(month);
  }
}
