import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FinanceService } from '../../core/services/finance.service';
import { MonthSummary } from '../../core/utils/finance-stats';
import { monthName } from '../../core/utils/month';
import { CopCurrencyPipe } from '../../shared/cop-currency.pipe';
import { StatusIconComponent } from '../../shared/status-icon.component';

interface Delta {
  text: string;
  direction: 'up' | 'down' | 'flat';
  /** Si el cambio es bueno para tus finanzas (subir ingresos sí, subir gastos no) */
  good: boolean;
}

@Component({
  selector: 'app-month-summary',
  imports: [CopCurrencyPipe, DecimalPipe, NgTemplateOutlet, StatusIconComponent],
  templateUrl: './month-summary.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonthSummaryComponent {
  private readonly financeService = inject(FinanceService);

  readonly summary = this.financeService.selectedSummary;
  readonly accumulated = this.financeService.accumulated;
  readonly savingsLine = computed(() => this.financeService.ruleProgress()[2]);
  readonly previousName = computed(() => monthName(this.financeService.previousSummary().month));

  readonly fixedShare = computed(() => {
    const { fixed, expense } = this.summary();
    return expense > 0 ? (fixed / expense) * 100 : 0;
  });

  readonly deltas = computed(() => {
    const current = this.summary();
    const previous = this.financeService.previousSummary();
    return {
      income: this.delta(current, previous, 'income', true),
      expense: this.delta(current, previous, 'expense', false),
      saved: this.delta(current, previous, 'saved', true),
      available: this.delta(current, previous, 'available', true),
    };
  });

  private delta(
    current: MonthSummary,
    previous: MonthSummary,
    key: 'income' | 'expense' | 'saved' | 'available',
    upIsGood: boolean,
  ): Delta | null {
    const before = previous[key];
    const now = current[key];
    if (before === 0) return null;
    const pct = Math.round(((now - before) / Math.abs(before)) * 100);
    const month = this.previousName().toLowerCase();
    if (pct === 0) return { text: `Igual que en ${month}`, direction: 'flat', good: true };
    const direction = pct > 0 ? 'up' : 'down';
    return {
      text: `${Math.abs(pct)}% ${pct > 0 ? 'más' : 'menos'} que en ${month}`,
      direction,
      good: (direction === 'up') === upIsGood,
    };
  }
}
