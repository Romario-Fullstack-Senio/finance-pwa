import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toast } from 'ngx-sonner';
import { KINDS_BY_TYPE, TransactionType } from '../../core/models/finance.models';
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
    type: this.fb.nonNullable.control<TransactionType>('expense'),
    amount: this.fb.nonNullable.control<number | null>(null, [
      Validators.required,
      Validators.min(1),
    ]),
    categoryId: this.fb.nonNullable.control('', [Validators.required]),
    date: this.fb.nonNullable.control(new Date().toISOString().slice(0, 10), [Validators.required]),
    note: this.fb.nonNullable.control(''),
  });

  readonly type = toSignal(this.form.controls.type.valueChanges, {
    initialValue: this.form.controls.type.value,
  });

  /** Categorías que aplican al tipo elegido; los gastos se agrupan en fijos y variables */
  readonly categoryGroups = computed(() => {
    const kinds = KINDS_BY_TYPE[this.type()];
    const byKind = (kind: string) => this.categories().filter((c) => c.kind === kind);
    if (this.type() === 'expense') {
      return [
        { label: 'Gastos fijos', options: byKind('fixed') },
        { label: 'Gastos variables', options: byKind('variable') },
      ];
    }
    return [{ label: '', options: this.categories().filter((c) => kinds.includes(c.kind)) }];
  });

  constructor() {
    // Al cambiar el tipo, soltar la categoría si ya no aplica
    this.form.controls.type.valueChanges.pipe(takeUntilDestroyed()).subscribe((type) => {
      const category = this.categories().find((c) => c.id === this.form.controls.categoryId.value);
      if (category && !KINDS_BY_TYPE[type].includes(category.kind)) {
        this.form.controls.categoryId.setValue('');
      }
    });
  }

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
