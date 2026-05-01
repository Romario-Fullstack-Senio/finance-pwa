import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toast } from 'ngx-sonner';
import { BalanceSummaryComponent } from '../../components/balance-summary/balance-summary.component';
import { BudgetFormComponent } from '../../components/budget-form/budget-form.component';
import { CategoryFormComponent } from '../../components/category-form/category-form.component';
import { SixMonthTrendComponent } from '../../components/six-month-trend/six-month-trend.component';
import { TransactionFormComponent } from '../../components/transaction-form/transaction-form.component';
import { TransactionsTableComponent } from '../../components/transactions-table/transactions-table.component';
import { FinanceService } from '../../core/services/finance.service';
import { ShellHeaderComponent } from './shell-header/shell-header.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    ShellHeaderComponent,
    BalanceSummaryComponent,
    BudgetFormComponent,
    TransactionFormComponent,
    CategoryFormComponent,
    TransactionsTableComponent,
    SixMonthTrendComponent,
  ],
  templateUrl: './shell.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent {
  readonly financeService = inject(FinanceService);
  readonly loading = this.financeService.loading;

  constructor() {
    void this.financeService.init();
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
    toast.success('Archivo CSV exportado.');
  }
}
