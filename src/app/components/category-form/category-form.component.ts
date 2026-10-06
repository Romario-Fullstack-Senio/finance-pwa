import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toast } from 'ngx-sonner';
import { CategoryKind, KIND_LABELS } from '../../core/models/finance.models';
import { FinanceService } from '../../core/services/finance.service';

@Component({
  selector: 'app-category-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './category-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryFormComponent {
  private readonly financeService = inject(FinanceService);
  private readonly fb = inject(FormBuilder);

  readonly categories = this.financeService.categories;
  readonly loading = signal(false);
  readonly kindLabels = KIND_LABELS;
  readonly kinds: CategoryKind[] = ['variable', 'fixed', 'income', 'savings'];

  readonly form = this.fb.nonNullable.group({
    name: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(2)]),
    color: this.fb.nonNullable.control('#2563eb'),
    kind: this.fb.nonNullable.control<CategoryKind>('variable'),
  });

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    try {
      const { name, color, kind } = this.form.getRawValue();
      await this.financeService.addCategory(name, color, kind);
      this.form.patchValue({ name: '', color: '#2563eb' });
      toast.success('Categoría agregada.');
    } catch {
      toast.error('Error al agregar categoría.');
    } finally {
      this.loading.set(false);
    }
  }
}
