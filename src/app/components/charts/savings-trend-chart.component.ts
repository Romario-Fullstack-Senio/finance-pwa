import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ChartConfiguration } from 'chart.js';
import { FinanceService } from '../../core/services/finance.service';
import { formatMonthLabel } from '../../core/utils/month';
import { formatCop } from '../../shared/cop-format';
import { CopCurrencyPipe } from '../../shared/cop-currency.pipe';
import { ChartComponent } from '../../shared/charts/chart.component';
import { copAxis, seriesColors } from '../../shared/charts/chart-setup';

@Component({
  selector: 'app-savings-trend-chart',
  imports: [ChartComponent, CopCurrencyPipe],
  templateUrl: './savings-trend-chart.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SavingsTrendChartComponent {
  private readonly financeService = inject(FinanceService);

  readonly accumulated = this.financeService.accumulated;
  readonly savingsPct = computed(() => this.financeService.rule().savings);
  readonly monthLabel = (month: string) => formatMonthLabel(month);

  /** Meta de cada mes con la regla actual: ingreso × % de ahorro */
  readonly rows = computed(() =>
    this.financeService.history().map((m) => ({
      month: m.month,
      saved: m.saved,
      target: Math.round((m.income * this.savingsPct()) / 100),
    })),
  );

  readonly hasData = computed(() => this.rows().some((row) => row.saved > 0 || row.target > 0));

  readonly label = computed(() => {
    const rows = this.rows();
    return `Línea del ahorro registrado por mes frente a la meta del ${this.savingsPct()}% de los ingresos, de ${formatMonthLabel(
      rows[0].month,
    )} a ${formatMonthLabel(rows[rows.length - 1].month)}. La tabla siguiente tiene los valores.`;
  });

  readonly config = computed<ChartConfiguration<'line'>>(() => {
    const rows = this.rows();
    const selected = this.financeService.selectedMonth();
    const colors = seriesColors();

    return {
      type: 'line',
      data: {
        labels: rows.map((row) => formatMonthLabel(row.month, 'short')),
        datasets: [
          {
            label: 'Ahorrado',
            data: rows.map((row) => row.saved),
            borderColor: colors.savings,
            backgroundColor: colors.savings,
            borderWidth: 2,
            tension: 0,
            pointRadius: rows.map((row) => (row.month === selected ? 6 : 4)),
            pointHoverRadius: 7,
            pointBorderColor: colors.surface,
            pointBorderWidth: 2,
          },
          {
            label: `Meta (${this.savingsPct()}%)`,
            data: rows.map((row) => row.target),
            borderColor: colors.muted,
            backgroundColor: colors.muted,
            borderWidth: 1.5,
            borderDash: [6, 4],
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHitRadius: 12,
          },
        ],
      },
      options: {
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { grid: { display: false }, border: { color: colors.hairline } },
          y: copAxis(),
        },
        plugins: {
          tooltip: {
            callbacks: {
              title: (items) => formatMonthLabel(rows[items[0].dataIndex].month),
              label: (item) => `${item.dataset.label}: ${formatCop(item.parsed.y ?? 0)}`,
            },
          },
        },
        onClick: (_event, elements) => {
          const element = elements[0];
          if (element) this.financeService.setSelectedMonth(rows[element.index].month);
        },
      },
    };
  });
}
