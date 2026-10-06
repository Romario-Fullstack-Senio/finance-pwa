import { Pipe, PipeTransform } from '@angular/core';
import { formatCop } from './cop-format';

@Pipe({
  name: 'copCurrency',
  standalone: true,
})
export class CopCurrencyPipe implements PipeTransform {
  transform(value: number | string | null | undefined): string {
    if (value === null || value === undefined || value === '') return '';
    const num = typeof value === 'string' ? Number(value) : value;
    if (isNaN(num)) return '';
    return formatCop(num);
  }
}
