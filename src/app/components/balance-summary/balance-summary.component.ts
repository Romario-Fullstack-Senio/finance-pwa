import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FinanceService } from '../../core/services/finance.service';
import { CopCurrencyPipe } from '../../shared/cop-currency.pipe';

@Component({
  selector: 'app-balance-summary',
  standalone: true,
  imports: [CopCurrencyPipe],
  templateUrl: './balance-summary.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BalanceSummaryComponent {
  private readonly financeService = inject(FinanceService);
  readonly totalIncome = this.financeService.totalIncome;
  readonly totalExpense = this.financeService.totalExpense;
  readonly balance = this.financeService.balance;
}
