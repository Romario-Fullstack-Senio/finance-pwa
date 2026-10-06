import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TransactionFormComponent } from '../../components/transaction-form/transaction-form.component';
import { TransactionsListComponent } from '../../components/transactions-list/transactions-list.component';

@Component({
  selector: 'app-movements-page',
  imports: [TransactionFormComponent, TransactionsListComponent],
  template: `
    <div class="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <app-transaction-form class="block lg:sticky lg:top-6" />
      <app-transactions-list class="block" />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MovementsPageComponent {}
