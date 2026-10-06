import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CategoryBreakdownChartComponent } from '../../components/charts/category-breakdown-chart.component';
import { IncomeExpenseChartComponent } from '../../components/charts/income-expense-chart.component';
import { SavingsTrendChartComponent } from '../../components/charts/savings-trend-chart.component';
import { MonthSummaryComponent } from '../../components/month-summary/month-summary.component';
import { RuleCardComponent } from '../../components/rule-card/rule-card.component';
import { FinanceService } from '../../core/services/finance.service';
import { monthName } from '../../core/utils/month';
import { formatCop } from '../../shared/cop-format';

@Component({
  selector: 'app-dashboard-page',
  imports: [
    RouterLink,
    MonthSummaryComponent,
    RuleCardComponent,
    IncomeExpenseChartComponent,
    CategoryBreakdownChartComponent,
    SavingsTrendChartComponent,
  ],
  templateUrl: './dashboard-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPageComponent {
  private readonly financeService = inject(FinanceService);

  readonly hasMovements = computed(() => this.financeService.selectedTransactions().length > 0);

  /** Una frase que responde "¿cómo me fue este mes?" */
  readonly verdict = computed(() => {
    const summary = this.financeService.selectedSummary();
    const month = monthName(summary.month).toLowerCase();
    const savings = this.financeService.ruleProgress()[2];

    if (summary.income === 0) {
      return `En ${month} gastaste ${formatCop(summary.expense)} y no has registrado ingresos.`;
    }
    const balance =
      summary.available >= 0
        ? `En ${month} ingresaron ${formatCop(summary.income)} y te quedan ${formatCop(summary.available)} sin asignar.`
        : `En ${month} usaste ${formatCop(-summary.available)} más de lo que ingresó.`;
    const saving =
      savings.status === 'ok'
        ? 'Cumpliste tu meta de ahorro.'
        : `Llevas ${formatCop(savings.actual)} ahorrados de los ${formatCop(savings.target)} que pide tu regla.`;
    return `${balance} ${saving}`;
  });
}
