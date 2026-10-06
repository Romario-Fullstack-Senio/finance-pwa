import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toast } from 'ngx-sonner';
import { BudgetRule, DEFAULT_RULE } from '../../core/models/finance.models';
import { FinanceService } from '../../core/services/finance.service';
import { RuleBucket } from '../../core/utils/finance-stats';
import { monthName } from '../../core/utils/month';
import { CopCurrencyPipe } from '../../shared/cop-currency.pipe';

const percent = [Validators.required, Validators.min(0), Validators.max(100), Validators.pattern(/^\d+$/)];

@Component({
  selector: 'app-rule-editor',
  imports: [ReactiveFormsModule, CopCurrencyPipe],
  templateUrl: './rule-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RuleEditorComponent {
  private readonly financeService = inject(FinanceService);
  private readonly fb = inject(FormBuilder);

  readonly income = computed(() => this.financeService.selectedSummary().income);
  readonly month = computed(() => monthName(this.financeService.selectedMonth()).toLowerCase());
  readonly saving = signal(false);

  readonly fields: { key: RuleBucket; label: string; hint: string; color: string }[] = [
    { key: 'needs', label: 'Necesidades', hint: 'Gastos fijos: vivienda, servicios…', color: 'var(--color-fixed)' },
    { key: 'wants', label: 'Deseos', hint: 'Gastos variables: comida fuera, salidas…', color: 'var(--color-variable)' },
    { key: 'savings', label: 'Ahorro', hint: 'Lo que apartas cada mes', color: 'var(--color-savings)' },
  ];

  readonly form = this.fb.nonNullable.group({
    needs: this.fb.nonNullable.control(DEFAULT_RULE.needs, percent),
    wants: this.fb.nonNullable.control(DEFAULT_RULE.wants, percent),
    savings: this.fb.nonNullable.control(DEFAULT_RULE.savings, percent),
  });

  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  readonly total = computed(() => {
    const { needs = 0, wants = 0, savings = 0 } = this.value();
    return Number(needs) + Number(wants) + Number(savings);
  });

  constructor() {
    // Mostrar la regla guardada mientras no haya cambios sin guardar
    effect(() => {
      const rule = this.financeService.rule();
      if (!this.form.dirty) this.form.setValue(rule);
    });
  }

  amount(key: RuleBucket): number {
    return Math.round((this.income() * Number(this.value()[key] ?? 0)) / 100);
  }

  restoreDefault(): void {
    this.form.setValue(DEFAULT_RULE);
    this.form.markAsDirty();
  }

  async save(): Promise<void> {
    if (this.form.invalid || this.total() !== 100) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    const rule: BudgetRule = {
      needs: Number(raw.needs),
      wants: Number(raw.wants),
      savings: Number(raw.savings),
    };
    this.saving.set(true);
    try {
      await this.financeService.updateRule(rule);
      this.form.markAsPristine();
      toast.success(`Regla ${rule.needs}/${rule.wants}/${rule.savings} guardada.`);
    } catch {
      toast.error('No se pudo guardar la regla.');
    } finally {
      this.saving.set(false);
    }
  }
}
