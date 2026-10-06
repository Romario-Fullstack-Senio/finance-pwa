import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BudgetFormComponent } from '../../components/budget-form/budget-form.component';
import { CategoryManagerComponent } from '../../components/category-manager/category-manager.component';
import { RuleEditorComponent } from '../../components/rule-editor/rule-editor.component';

@Component({
  selector: 'app-budgets-page',
  imports: [RuleEditorComponent, BudgetFormComponent, CategoryManagerComponent],
  template: `
    <div class="space-y-5">
      <app-rule-editor class="block" />
      <div class="grid items-start gap-5 xl:grid-cols-2">
        <app-budget-form class="block" />
        <app-category-manager class="block" />
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetsPageComponent {}
