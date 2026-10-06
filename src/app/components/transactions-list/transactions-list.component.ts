import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toast } from 'ngx-sonner';
import { Transaction, TransactionType } from '../../core/models/finance.models';
import { FinanceService } from '../../core/services/finance.service';
import { monthName } from '../../core/utils/month';
import { formatCop } from '../../shared/cop-format';
import { CopCurrencyPipe } from '../../shared/cop-currency.pipe';

type Filter = 'all' | TransactionType;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'income', label: 'Ingresos' },
  { value: 'expense', label: 'Gastos' },
  { value: 'saving', label: 'Ahorros' },
];

const TYPE_LABELS: Record<TransactionType, string> = {
  income: 'Ingreso',
  expense: 'Gasto',
  saving: 'Ahorro',
};

@Component({
  selector: 'app-transactions-list',
  imports: [DatePipe, CopCurrencyPipe],
  templateUrl: './transactions-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionsListComponent {
  private readonly financeService = inject(FinanceService);

  readonly filters = FILTERS;
  readonly typeLabels = TYPE_LABELS;
  readonly filter = signal<Filter>('all');
  readonly month = computed(() => monthName(this.financeService.selectedMonth()).toLowerCase());
  readonly summary = this.financeService.selectedSummary;

  private readonly categoriesById = computed(
    () => new Map(this.financeService.categories().map((c) => [c.id, c])),
  );

  readonly rows = computed(() => {
    const filter = this.filter();
    return this.financeService
      .selectedTransactions()
      .filter((tx) => filter === 'all' || tx.type === filter)
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  });

  readonly total = computed(() =>
    this.rows().reduce((sum, tx) => sum + (tx.type === 'income' ? tx.amount : -tx.amount), 0),
  );

  categoryName(tx: Transaction): string {
    return this.categoriesById().get(tx.categoryId)?.name ?? 'Sin categoría';
  }

  categoryColor(tx: Transaction): string {
    return this.categoriesById().get(tx.categoryId)?.color ?? '#64748b';
  }

  deleteLabel(tx: Transaction): string {
    return `Eliminar ${TYPE_LABELS[tx.type].toLowerCase()} de ${formatCop(tx.amount)} en ${this.categoryName(tx)}`;
  }

  async remove(tx: Transaction): Promise<void> {
    try {
      await this.financeService.deleteTransaction(tx.id);
      toast.success(`${TYPE_LABELS[tx.type]} eliminado.`);
    } catch {
      toast.error('No se pudo eliminar el movimiento.');
    }
  }
}
