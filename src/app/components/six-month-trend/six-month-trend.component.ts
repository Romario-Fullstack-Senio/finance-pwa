import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FinanceService } from '../../core/services/finance.service';
import { CopCurrencyPipe } from '../../shared/cop-currency.pipe';

const MONTHS_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

@Component({
  selector: 'app-six-month-trend',
  standalone: true,
  imports: [CopCurrencyPipe],
  templateUrl: './six-month-trend.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SixMonthTrendComponent {
  private readonly financeService = inject(FinanceService);
  readonly sixMonthTrend = this.financeService.sixMonthTrend;

  readonly maxTrendValue = computed(() => {
    const max = this.sixMonthTrend().reduce(
      (acc, row) => Math.max(acc, row.income, row.expense),
      0,
    );
    return max === 0 ? 1 : max;
  });

  formatMonth(yyyyMM: string): string {
    const [year, month] = yyyyMM.split('-').map(Number);
    return `${MONTHS_ES[month - 1]} ${year}`;
  }
}
