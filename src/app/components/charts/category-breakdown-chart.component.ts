import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ChartConfiguration } from 'chart.js';
import { CategoryKind } from '../../core/models/finance.models';
import { FinanceService } from '../../core/services/finance.service';
import { monthName } from '../../core/utils/month';
import { formatCop } from '../../shared/cop-format';
import { CopCurrencyPipe } from '../../shared/cop-currency.pipe';
import { ChartComponent } from '../../shared/charts/chart.component';
import { copAxis, seriesColors } from '../../shared/charts/chart-setup';

const MAX_BARS = 7;

interface Row {
  name: string;
  kind: CategoryKind | 'other';
  spent: number;
  share: number;
  budget: number | null;
}

@Component({
  selector: 'app-category-breakdown-chart',
  imports: [ChartComponent, CopCurrencyPipe, DecimalPipe],
  templateUrl: './category-breakdown-chart.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryBreakdownChartComponent {
  private readonly financeService = inject(FinanceService);

  readonly month = computed(() => monthName(this.financeService.selectedMonth()).toLowerCase());
  readonly total = computed(() => this.financeService.selectedSummary().expense);

  /** Las 7 categorías con más gasto; el resto se agrupa en "Otras" para no saturar el gráfico */
  readonly rows = computed<Row[]>(() => {
    const spending = this.financeService.categoryBreakdown().filter((item) => item.spent > 0);
    const rows: Row[] = spending.map((item) => ({
      name: item.category.name,
      kind: item.category.kind,
      spent: item.spent,
      share: item.share,
      budget: item.budget,
    }));
    if (rows.length <= MAX_BARS + 1) return rows;

    const rest = rows.slice(MAX_BARS);
    return [
      ...rows.slice(0, MAX_BARS),
      {
        name: `Otras ${rest.length} categorías`,
        kind: 'other',
        spent: rest.reduce((sum, row) => sum + row.spent, 0),
        share: rest.reduce((sum, row) => sum + row.share, 0),
        budget: null,
      },
    ];
  });

  readonly height = computed(() => this.rows().length * 36 + 36);

  readonly label = computed(
    () =>
      `Gasto por categoría en ${this.month()}, de mayor a menor: ` +
      this.rows()
        .map((row) => `${row.name} ${formatCop(row.spent)}`)
        .join(', '),
  );

  readonly config = computed<ChartConfiguration<'bar'>>(() => {
    const rows = this.rows();
    const colors = seriesColors();
    const colorOf = (kind: Row['kind']) =>
      kind === 'fixed' ? colors.fixed : kind === 'variable' ? colors.variable : colors.available;

    return {
      type: 'bar',
      data: {
        labels: rows.map((row) => row.name),
        datasets: [
          {
            label: 'Gastado',
            data: rows.map((row) => row.spent),
            backgroundColor: rows.map((row) => colorOf(row.kind)),
            borderRadius: 4,
            borderSkipped: 'start',
            maxBarThickness: 18,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        scales: {
          x: copAxis(),
          y: { grid: { display: false }, border: { display: false }, ticks: { color: colors.ink } },
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: (item) => {
                const row = rows[item.dataIndex];
                return `${formatCop(row.spent)}, ${Math.round(row.share * 100)}% del gasto del mes`;
              },
              afterLabel: (item) => {
                const budget = rows[item.dataIndex].budget;
                if (budget === null) return '';
                const used = Math.round((rows[item.dataIndex].spent / budget) * 100);
                return `Presupuesto ${formatCop(budget)} (usado ${used}%)`;
              },
            },
          },
        },
      },
    };
  });
}
