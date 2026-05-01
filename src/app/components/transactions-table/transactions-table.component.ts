import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toast } from 'ngx-sonner';
import { FinanceService } from '../../core/services/finance.service';
import { CopCurrencyPipe } from '../../shared/cop-currency.pipe';

@Component({
  selector: 'app-transactions-table',
  standalone: true,
  imports: [DatePipe, CopCurrencyPipe],
  templateUrl: './transactions-table.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionsTableComponent {
  private readonly financeService = inject(FinanceService);
  readonly transactions = this.financeService.transactions;
  readonly categories = this.financeService.categories;

  getCategoryName(categoryId: string): string {
    return this.categories().find((c) => c.id === categoryId)?.name ?? categoryId;
  }

  getCategoryColor(categoryId: string): string {
    return this.categories().find((c) => c.id === categoryId)?.color ?? '#94a3b8';
  }

  async remove(id: string): Promise<void> {
    try {
      await this.financeService.deleteTransaction(id);
      toast.success('Transacción eliminada.');
    } catch {
      toast.error('Error al eliminar la transacción.');
    }
  }
}
