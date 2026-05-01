import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toast } from 'ngx-sonner';
import { FinanceService } from '../../core/services/finance.service';
import { CopCurrencyPipe } from '../../shared/cop-currency.pipe';

@Component({
  selector: 'app-budget-form',
  standalone: true,
  imports: [ReactiveFormsModule, CopCurrencyPipe],
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
    limit: this.fb.nonNullable.control(0, [Validators.required, Validators.min(1)]),
  });

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    try {
      const { categoryId, month, limit } = this.form.getRawValue();
      await this.financeService.upsertBudget(categoryId, month, limit);
      this.form.patchValue({ limit: 0 });
      toast.success('Presupuesto actualizado.');
    } catch {
      toast.error('Error al guardar presupuesto.');
    } finally {
      this.loading.set(false);
    }
  }
}
