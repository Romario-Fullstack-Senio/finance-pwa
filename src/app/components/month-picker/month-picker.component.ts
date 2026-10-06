import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { FinanceService } from '../../core/services/finance.service';
import { currentMonthKey, monthName, shiftMonth } from '../../core/utils/month';

@Component({
  selector: 'app-month-picker',
  templateUrl: './month-picker.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonthPickerComponent {
  private readonly financeService = inject(FinanceService);
  private readonly nativePicker = viewChild.required<ElementRef<HTMLInputElement>>('nativePicker');

  readonly selected = this.financeService.selectedMonth;
  readonly name = computed(() => monthName(this.selected()));
  readonly year = computed(() => this.selected().slice(0, 4));
  readonly previousName = computed(() => monthName(shiftMonth(this.selected(), -1)));
  readonly nextName = computed(() => monthName(shiftMonth(this.selected(), 1)));
  readonly isCurrent = computed(() => this.selected() === currentMonthKey());

  move(delta: number): void {
    this.financeService.setSelectedMonth(shiftMonth(this.selected(), delta));
  }

  goToCurrent(): void {
    this.financeService.setSelectedMonth(currentMonthKey());
  }

  openPicker(): void {
    const input = this.nativePicker().nativeElement;
    try {
      input.showPicker();
    } catch {
      input.focus();
    }
  }

  onPicked(value: string): void {
    if (/^\d{4}-\d{2}$/.test(value)) this.financeService.setSelectedMonth(value);
  }
}
