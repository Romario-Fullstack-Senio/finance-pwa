import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toast } from 'ngx-sonner';
import { FinanceService } from '../../core/services/finance.service';
import { monthName } from '../../core/utils/month';
import { formatCop } from '../../shared/cop-format';
import { CopCurrencyPipe } from '../../shared/cop-currency.pipe';
import { CopMoneyInputDirective } from '../../shared/cop-money-input.directive';
import { Status, StatusIconComponent } from '../../shared/status-icon.component';

@Component({
  selector: 'app-budget-form',
  imports: [ReactiveFormsModule, CopCurrencyPipe, CopMoneyInputDirective, StatusIconComponent],
  templateUrl: './budget-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetFormComponent {
  private readonly financeService = inject(FinanceService);
  private readonly fb = inject(FormBuilder);

  readonly month = computed(() => monthName(this.financeService.selectedMonth()).toLowerCase());
  readonly fixedCategories = computed(() =>
    this.financeService.categories().filter((c) => c.kind === 'fixed'),
  );
  readonly variableCategories = computed(() =>
    this.financeService.categories().filter((c) => c.kind === 'variable'),
  );
  readonly loading = signal(false);

  /** Categorías con presupuesto este mes y cuánto se ha usado */
  readonly progress = computed(() =>
    this.financeService
      .categoryBreakdown()
      .filter((item) => item.budget !== null)
      .map((item) => {
        const budget = item.budget!;
        const used = item.spent / budget;
        const status: Status = used > 1 ? 'critical' : used >= 0.9 ? 'warning' : 'good';
        const message =
          used > 1
            ? `Excedido por ${formatCop(item.spent - budget)}`
            : `Quedan ${formatCop(budget - item.spent)}`;
        const color =
          status === 'critical'
            ? 'var(--color-critical)'
            : item.category.kind === 'fixed'
              ? 'var(--color-fixed)'
              : 'var(--color-variable)';
        return { ...item, budget, width: Math.min(used, 1) * 100, status, message, color };
      }),
  );

  readonly form = this.fb.nonNullable.group({
    categoryId: this.fb.nonNullable.control('', [Validators.required]),
    limit: this.fb.nonNullable.control<number | null>(null, [
      Validators.required,
      Validators.min(1),
    ]),
  });

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { categoryId, limit } = this.form.getRawValue();
    if (limit === null) return;
    this.loading.set(true);
    try {
      await this.financeService.upsertBudget(
        categoryId,
        this.financeService.selectedMonth(),
        limit,
      );
      this.form.reset({ categoryId: '', limit: null });
      toast.success('Presupuesto guardado.');
    } catch {
      toast.error('No se pudo guardar el presupuesto.');
    } finally {
      this.loading.set(false);
    }
  }
}
