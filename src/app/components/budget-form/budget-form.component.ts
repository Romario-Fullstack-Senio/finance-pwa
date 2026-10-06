import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toast } from 'ngx-sonner';
import { FinanceService } from '../../core/services/finance.service';
import { CopCurrencyPipe } from '../../shared/cop-currency.pipe';
import { CopMoneyInputDirective } from '../../shared/cop-money-input.directive';

@Component({
  selector: 'app-budget-form',
  standalone: true,
  imports: [ReactiveFormsModule, CopCurrencyPipe, CopMoneyInputDirective],
  templateUrl: './budget-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetFormComponent {
  private readonly financeService = inject(FinanceService);
  private readonly fb = inject(FormBuilder);

  readonly categories = this.financeService.categories;
  readonly monthExpensesByCategory = this.financeService.monthExpensesByCategory;
  readonly loading = signal(false);

  readonly form = this.fb.nonNullable.group({
    categoryId: this.fb.nonNullable.control('', [Validators.required]),
    month: this.fb.nonNullable.control(new Date().toISOString().slice(0, 7), [Validators.required]),
    limit: this.fb.nonNullable.control<number | null>(null, [Validators.required, Validators.min(1)]),
  });

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { categoryId, month, limit } = this.form.getRawValue();
    if (limit === null) return;
    this.loading.set(true);
    try {
      await this.financeService.upsertBudget(categoryId, month, limit);
      this.form.patchValue({ limit: null });
      this.form.controls.limit.markAsUntouched();
      toast.success('Presupuesto actualizado.');
    } catch {
      toast.error('Error al guardar presupuesto.');
    } finally {
      this.loading.set(false);
    }
  }
}
