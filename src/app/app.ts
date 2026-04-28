import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FinanceService } from './core/services/finance.service';

@Component({
  selector: 'app-root',
  imports: [CommonModule, ReactiveFormsModule, CurrencyPipe, DatePipe],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private readonly financeService = inject(FinanceService);
  private readonly fb = inject(FormBuilder);

  readonly loading = this.financeService.loading;
  readonly syncing = this.financeService.syncing;
  readonly transactions = this.financeService.transactions;
  readonly categories = this.financeService.categories;
  readonly totalIncome = this.financeService.totalIncome;
  readonly totalExpense = this.financeService.totalExpense;
  readonly balance = this.financeService.balance;
  readonly monthExpensesByCategory = this.financeService.monthExpensesByCategory;
  readonly sixMonthTrend = this.financeService.sixMonthTrend;

  readonly successMessage = signal('');

  readonly transactionForm = this.fb.nonNullable.group({
    type: this.fb.nonNullable.control<'income' | 'expense'>('expense'),
    amount: this.fb.nonNullable.control(0, [Validators.required, Validators.min(0.01)]),
    categoryId: this.fb.nonNullable.control('', [Validators.required]),
    date: this.fb.nonNullable.control(new Date().toISOString().slice(0, 10), [Validators.required]),
    note: this.fb.nonNullable.control('')
  });

  readonly categoryForm = this.fb.nonNullable.group({
    name: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(2)]),
    color: this.fb.nonNullable.control('#2563eb')
  });

  readonly budgetForm = this.fb.nonNullable.group({
    categoryId: this.fb.nonNullable.control('', [Validators.required]),
    month: this.fb.nonNullable.control(new Date().toISOString().slice(0, 7), [Validators.required]),
    limit: this.fb.nonNullable.control(0, [Validators.required, Validators.min(1)])
  });

  readonly maxTrendValue = computed(() => {
    const max = this.sixMonthTrend().reduce((acc, row) => Math.max(acc, row.income, row.expense), 0);
    return max === 0 ? 1 : max;
  });

  constructor() {
    void this.financeService.init();
  }

  async addTransaction(): Promise<void> {
    if (this.transactionForm.invalid) {
      this.transactionForm.markAllAsTouched();
      return;
    }

    await this.financeService.addTransaction(this.transactionForm.getRawValue());
    this.transactionForm.patchValue({
      amount: 0,
      note: '',
      date: new Date().toISOString().slice(0, 10)
    });

    this.setMessage('Transaccion guardada.');
  }

  async removeTransaction(id: string): Promise<void> {
    await this.financeService.deleteTransaction(id);
    this.setMessage('Transaccion eliminada.');
  }

  async addCategory(): Promise<void> {
    if (this.categoryForm.invalid) {
      this.categoryForm.markAllAsTouched();
      return;
    }

    const values = this.categoryForm.getRawValue();
    await this.financeService.addCategory(values.name, values.color);
    this.categoryForm.patchValue({ name: '', color: '#2563eb' });
    this.setMessage('Categoria agregada.');
  }

  async saveBudget(): Promise<void> {
    if (this.budgetForm.invalid) {
      this.budgetForm.markAllAsTouched();
      return;
    }

    const values = this.budgetForm.getRawValue();
    await this.financeService.upsertBudget(values.categoryId, values.month, values.limit);
    this.budgetForm.patchValue({ limit: 0 });
    this.setMessage('Presupuesto actualizado.');
  }

  async exportCsv(): Promise<void> {
    const csv = await this.financeService.exportCsv();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `finanzas-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();

    URL.revokeObjectURL(url);
    this.setMessage('Archivo CSV exportado.');
  }

  async syncNow(): Promise<void> {
    await this.financeService.syncToSupabase();
    this.setMessage('Sincronizacion ejecutada.');
  }

  getCategoryName(categoryId: string): string {
    return this.categories().find((item) => item.id === categoryId)?.name ?? categoryId;
  }

  getCategoryColor(categoryId: string): string {
    return this.categories().find((item) => item.id === categoryId)?.color ?? '#94a3b8';
  }

  private setMessage(message: string): void {
    this.successMessage.set(message);
    setTimeout(() => this.successMessage.set(''), 2500);
  }
}
