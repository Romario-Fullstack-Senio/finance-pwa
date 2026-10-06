import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CopMoneyInputDirective } from './cop-money-input.directive';

@Component({
  imports: [ReactiveFormsModule, CopMoneyInputDirective],
  template: `<input type="text" inputmode="numeric" appCopMoney [formControl]="control" />`,
})
class HostComponent {
  readonly control = new FormControl<number | null>(null);
}

const nbsp = (text: string) => text.replace(/ /g, ' ');

describe('CopMoneyInputDirective', () => {
  let host: HostComponent;
  let input: HTMLInputElement;

  beforeEach(() => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    host = fixture.componentInstance;
    input = fixture.nativeElement.querySelector('input');
  });

  /** Simula que el navegador dejó `value` en el input con el cursor en `caret` */
  function type(value: string, caret = value.length): void {
    input.value = value;
    input.setSelectionRange(caret, caret);
    input.dispatchEvent(new Event('input'));
  }

  function pressDelete(inputType: 'deleteContentBackward' | 'deleteContentForward', caret: number) {
    input.setSelectionRange(caret, caret);
    const event = new InputEvent('beforeinput', { inputType, cancelable: true });
    input.dispatchEvent(event);
    return event;
  }

  it('muestra el monto formateado y guarda el número limpio', () => {
    type('1500000');
    expect(input.value).toBe(nbsp('$ 1.500.000'));
    expect(host.control.value).toBe(1500000);
    expect(input.selectionStart).toBe(input.value.length);
  });

  it('formatea el valor que llega desde el formulario', () => {
    host.control.setValue(2500);
    expect(input.value).toBe(nbsp('$ 2.500'));
    host.control.setValue(null);
    expect(input.value).toBe('');
  });

  it('deja el control en null al borrar todo', () => {
    type('5');
    type('');
    expect(host.control.value).toBeNull();
    expect(input.value).toBe('');
  });

  it('conserva el cursor al escribir en medio del número', () => {
    // "$ 1.500" con un 2 escrito después del 1 → "$ 12.500", cursor después del 2
    type(nbsp('$ 12.500'), 4);
    expect(input.value).toBe(nbsp('$ 12.500'));
    expect(input.selectionStart).toBe(4);
  });

  it('borrar hacia atrás sobre el punto elimina el dígito anterior', () => {
    host.control.setValue(1500);
    const event = pressDelete('deleteContentBackward', 4); // "$ 1.|500"
    expect(event.defaultPrevented).toBe(true);
    expect(input.value).toBe(nbsp('$ 500'));
    expect(host.control.value).toBe(500);
    expect(input.selectionStart).toBe(2);
  });

  it('suprimir sobre el punto elimina el dígito siguiente', () => {
    host.control.setValue(1500);
    pressDelete('deleteContentForward', 3); // "$ 1|.500"
    expect(input.value).toBe(nbsp('$ 100'));
    expect(input.selectionStart).toBe(3);
  });

  it('no interfiere al borrar un dígito normal', () => {
    host.control.setValue(1500);
    const event = pressDelete('deleteContentBackward', 3); // "$ 1|.500"
    expect(event.defaultPrevented).toBe(false);
  });

  it('marca el control como tocado al salir', () => {
    input.dispatchEvent(new Event('blur'));
    expect(host.control.touched).toBe(true);
  });
});
