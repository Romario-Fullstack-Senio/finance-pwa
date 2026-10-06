import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toast } from 'ngx-sonner';
import { Category, CategoryKind, KIND_LABELS } from '../../core/models/finance.models';
import { FinanceService } from '../../core/services/finance.service';

const KIND_ORDER: CategoryKind[] = ['fixed', 'variable', 'income', 'savings'];

const KIND_GROUPS: Record<CategoryKind, string> = {
  fixed: 'Gastos fijos (necesidades)',
  variable: 'Gastos variables (deseos)',
  income: 'Ingresos',
  savings: 'Ahorro',
};

@Component({
  selector: 'app-category-manager',
  imports: [ReactiveFormsModule],
  templateUrl: './category-manager.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryManagerComponent {
  private readonly financeService = inject(FinanceService);
  private readonly fb = inject(FormBuilder);

  readonly kinds = KIND_ORDER;
  readonly kindLabels = KIND_LABELS;
  readonly loading = signal(false);

  readonly groups = computed(() =>
    KIND_ORDER.map((kind) => ({
      kind,
      title: KIND_GROUPS[kind],
      categories: this.financeService.categories().filter((c) => c.kind === kind),
    })).filter((group) => group.categories.length > 0),
  );

  readonly form = this.fb.nonNullable.group({
    name: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(2)]),
    kind: this.fb.nonNullable.control<CategoryKind>('variable'),
    color: this.fb.nonNullable.control('#2563eb'),
  });

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { name, color, kind } = this.form.getRawValue();
    if (this.financeService.categories().some((c) => c.name.toLowerCase() === name.trim().toLowerCase())) {
      toast.error(`Ya tienes una categoría llamada "${name.trim()}".`);
      return;
    }
    this.loading.set(true);
    try {
      await this.financeService.addCategory(name, color, kind);
      this.form.reset({ name: '', kind, color: '#2563eb' });
      toast.success(`Categoría "${name.trim()}" creada.`);
    } catch {
      toast.error('No se pudo crear la categoría.');
    } finally {
      this.loading.set(false);
    }
  }

  async changeKind(category: Category, kind: string): Promise<void> {
    try {
      await this.financeService.updateCategoryKind(category.id, kind as CategoryKind);
      toast.success(`"${category.name}" ahora es ${KIND_LABELS[kind as CategoryKind].toLowerCase()}.`);
    } catch {
      toast.error('No se pudo cambiar el tipo.');
    }
  }
}
