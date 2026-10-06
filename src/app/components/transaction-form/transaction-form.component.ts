import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toast } from 'ngx-sonner';
import { FinanceService } from '../../core/services/finance.service';
import { CopMoneyInputDirective } from '../../shared/cop-money-input.directive';

@Component({
  selector: 'app-transaction-form',
  standalone: true,
  imports: [ReactiveFormsModule, CopMoneyInputDirective],
  templateUrl: './transaction-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionFormComponent {
  private readonly financeService = inject(FinanceService);
  private readonly fb = inject(FormBuilder);

  readonly categories = this.financeService.categories;
  readonly loading = signal(false);

  readonly form = this.fb.nonNullable.group({
    type: this.fb.nonNullable.control<'income' | 'expense'>('expense'),
    amount: this.fb.nonNullable.control<number | null>(null, [
      Validators.required,
      Validators.min(1),
    ]),
    categoryId: this.fb.nonNullable.control('', [Validators.required]),
    date: this.fb.nonNullable.control(new Date().toISOString().slice(0, 10), [Validators.required]),
    note: this.fb.nonNullable.control(''),
  });

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { amount, ...rest } = this.form.getRawValue();
    if (amount === null) return;
    this.loading.set(true);
    try {
      await this.financeService.addTransaction({ ...rest, amount });
      this.form.patchValue({ amount: null, note: '', date: new Date().toISOString().slice(0, 10) });
      this.form.controls.amount.markAsUntouched();
      toast.success('Transacción guardada.');
    } catch {
      toast.error('Error al guardar la transacción.');
    } finally {
      this.loading.set(false);
    }
  }
}
