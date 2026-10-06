import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FinanceService } from '../../core/services/finance.service';
import { RuleBucket, RuleLine } from '../../core/utils/finance-stats';
import { monthName } from '../../core/utils/month';
import { formatCop } from '../../shared/cop-format';
import { CopCurrencyPipe } from '../../shared/cop-currency.pipe';
import { Status, StatusIconComponent } from '../../shared/status-icon.component';

const BUCKETS: Record<RuleBucket, { name: string; detail: string; color: string }> = {
  needs: { name: 'Necesidades', detail: 'gastos fijos', color: 'var(--color-fixed)' },
  wants: { name: 'Deseos', detail: 'gastos variables', color: 'var(--color-variable)' },
  savings: { name: 'Ahorro', detail: 'lo que apartaste', color: 'var(--color-savings)' },
};

@Component({
  selector: 'app-rule-card',
  imports: [CopCurrencyPipe, DecimalPipe, RouterLink, StatusIconComponent],
  templateUrl: './rule-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RuleCardComponent {
  private readonly financeService = inject(FinanceService);

  readonly rule = this.financeService.rule;
  readonly summary = this.financeService.selectedSummary;
  readonly month = computed(() => monthName(this.financeService.selectedMonth()).toLowerCase());
  readonly buckets = BUCKETS;

  readonly lines = computed(() =>
    this.financeService.ruleProgress().map((line) => ({ ...line, ...this.describe(line) })),
  );

  /** Base de la barra: el ingreso, o lo que salió si se usó más de lo que ingresó */
  private readonly base = computed(() => {
    const { income, expense, saved } = this.summary();
    return Math.max(income, expense + saved);
  });

  readonly overspent = computed(() => {
    const { income, expense, saved } = this.summary();
    return Math.max(0, expense + saved - income);
  });

  readonly segments = computed(() => {
    const { fixed, variable, saved, available } = this.summary();
    const base = this.base();
    return [
      { key: 'fixed', label: 'Necesidades', value: fixed, color: 'var(--color-fixed)' },
      { key: 'variable', label: 'Deseos', value: variable, color: 'var(--color-variable)' },
      { key: 'saved', label: 'Ahorro', value: saved, color: 'var(--color-savings)' },
      { key: 'available', label: 'Disponible', value: Math.max(available, 0), color: 'var(--color-available)' },
    ]
      .filter((segment) => segment.value > 0)
      .map((segment) => ({ ...segment, width: (segment.value / base) * 100 }));
  });

  /** El reparto que pide la regla, a la misma escala que la barra real para compararlas */
  readonly planSegments = computed(() => {
    const { needs, wants, savings } = this.rule();
    const scale = this.summary().income / this.base();
    return [
      { key: 'needs', label: 'Necesidades', pct: needs, color: 'var(--color-fixed)' },
      { key: 'wants', label: 'Deseos', pct: wants, color: 'var(--color-variable)' },
      { key: 'savings', label: 'Ahorro', pct: savings, color: 'var(--color-savings)' },
    ]
      .filter((segment) => segment.pct > 0)
      .map((segment) => ({ ...segment, width: segment.pct * scale }));
  });

  readonly planLabel = computed(() =>
    this.planSegments()
      .map((segment) => `${segment.label} ${segment.pct}%`)
      .join(', '),
  );

  readonly stripLabel = computed(() =>
    this.segments()
      .map((segment) => `${segment.label} ${formatCop(segment.value)}`)
      .join(', '),
  );

  private describe(line: RuleLine): { status: Status; message: string } {
    if (line.bucket === 'savings') {
      return line.status === 'ok'
        ? { status: 'good', message: 'Meta cumplida' }
        : { status: 'warning', message: `Te faltan ${formatCop(line.target - line.actual)}` };
    }
    return line.status === 'over'
      ? { status: 'critical', message: `Te pasaste por ${formatCop(line.actual - line.target)}` }
      : { status: 'good', message: `Te quedan ${formatCop(line.target - line.actual)}` };
  }
}
