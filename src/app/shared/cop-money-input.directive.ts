import { Directive, ElementRef, forwardRef, inject } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { formatCop, parseCop } from './cop-format';

const DIGIT = /\d/;

function countDigits(text: string): number {
  return text.replace(/\D/g, '').length;
}

/** Posición del cursor justo después del dígito número `digits` (0 = antes del primero) */
function caretAfterDigits(text: string, digits: number): number {
  if (digits <= 0) {
    const first = text.search(DIGIT);
    return first === -1 ? text.length : first;
  }
  let seen = 0;
  for (let i = 0; i < text.length; i++) {
    if (DIGIT.test(text[i]) && ++seen === digits) return i + 1;
  }
  return text.length;
}

/**
 * Input de dinero en pesos colombianos: muestra "$ 1.500.000" mientras se escribe
 * y entrega al formulario el número limpio (1500000), o null si está vacío.
 *
 * Uso: <input type="text" inputmode="numeric" appCopMoney formControlName="amount" />
 */
@Directive({
  selector: 'input[appCopMoney]',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CopMoneyInputDirective),
      multi: true,
    },
  ],
  host: {
    '(input)': 'onInput()',
    '(beforeinput)': 'onBeforeInput($event)',
    '(blur)': 'onTouched()',
  },
})
export class CopMoneyInputDirective implements ControlValueAccessor {
  private readonly input = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;
  private onChange: (value: number | null) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  writeValue(value: number | null | undefined): void {
    this.input.value = value === null || value === undefined ? '' : formatCop(value);
  }

  registerOnChange(fn: (value: number | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.input.disabled = disabled;
  }

  protected onInput(): void {
    const { value, selectionStart } = this.input;
    this.apply(value, selectionStart ?? value.length);
  }

  /** Borrar sobre un separador ('.', '$ ') elimina el dígito vecino en vez de no hacer nada */
  protected onBeforeInput(event: InputEvent): void {
    const { value, selectionStart: start, selectionEnd: end } = this.input;
    if (start === null || start !== end) return;

    if (event.inputType === 'deleteContentBackward' && start > 0 && !DIGIT.test(value[start - 1])) {
      const index = value.slice(0, start).search(/\d\D*$/);
      if (index === -1) return;
      event.preventDefault();
      this.apply(value.slice(0, index) + value.slice(index + 1), index);
    } else if (
      event.inputType === 'deleteContentForward' &&
      start < value.length &&
      !DIGIT.test(value[start])
    ) {
      const offset = value.slice(start).search(DIGIT);
      if (offset === -1) return;
      event.preventDefault();
      const index = start + offset;
      this.apply(value.slice(0, index) + value.slice(index + 1), start);
    }
  }

  /** Reformatea `raw` conservando el cursor después de los mismos dígitos */
  private apply(raw: string, caret: number): void {
    const digitsBeforeCaret = countDigits(raw.slice(0, caret));
    const amount = parseCop(raw);
    const formatted = amount === null ? '' : formatCop(amount);

    this.input.value = formatted;
    const position = caretAfterDigits(formatted, digitsBeforeCaret);
    this.input.setSelectionRange(position, position);
    this.onChange(amount);
  }
}
