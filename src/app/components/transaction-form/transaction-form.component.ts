import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toast } from 'ngx-sonner';
import { FinanceService } from '../../core/services/finance.service';
import { CopCurrencyPipe } from '../../shared/cop-currency.pipe';

@Component({
  selector: 'app-transaction-form',
  standalone: true,
  imports: [ReactiveFormsModule, CopCurrencyPipe],
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
    amount: this.fb.nonNullable.control(0, [Validators.required, Validators.min(0.01)]),
    categoryId: this.fb.nonNullable.control('', [Validators.required]),
    date: this.fb.nonNullable.control(new Date().toISOString().slice(0, 10), [Validators.required]),
    note: this.fb.nonNullable.control(''),
  });

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    try {
      await this.financeService.addTransaction(this.form.getRawValue());
      this.form.patchValue({ amount: 0, note: '', date: new Date().toISOString().slice(0, 10) });
      toast.success('Transacción guardada.');
    } catch {
      toast.error('Error al guardar la transacción.');
    } finally {
      this.loading.set(false);
    }
  }
}
