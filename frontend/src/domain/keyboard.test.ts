import { describe, expect, it } from 'vitest';
import { DIGITS, OPERATORS } from './calculator';
import type { CalculatorAction } from './calculator';
import { KEYBOARD_ACTIONS, actionForKeyboardEvent } from './keyboard';

describe('actionForKeyboardEvent', () => {
  it('переводит каждую цифру в действие ввода', () => {
    for (const digit of DIGITS) {
      expect(actionForKeyboardEvent(digit)).toEqual({ type: 'digit', digit });
    }
  });

  it('переводит десятичные разделители', () => {
    expect(actionForKeyboardEvent('.')).toEqual({ type: 'decimal' });
    expect(actionForKeyboardEvent(',')).toEqual({ type: 'decimal' });
  });

  it('переводит арифметические операторы в символы контракта', () => {
    expect(actionForKeyboardEvent('+')).toEqual({ type: 'operator', operator: '+' });
    expect(actionForKeyboardEvent('-')).toEqual({ type: 'operator', operator: '-' });
    expect(actionForKeyboardEvent('*')).toEqual({ type: 'operator', operator: '×' });
    expect(actionForKeyboardEvent('×')).toEqual({ type: 'operator', operator: '×' });
    expect(actionForKeyboardEvent('/')).toEqual({ type: 'operator', operator: '÷' });
    expect(actionForKeyboardEvent('÷')).toEqual({ type: 'operator', operator: '÷' });
  });

  it('переводит завершение, сброс и служебные клавиши', () => {
    expect(actionForKeyboardEvent('=')).toEqual({ type: 'equals' });
    expect(actionForKeyboardEvent('Enter')).toEqual({ type: 'equals' });
    expect(actionForKeyboardEvent('Escape')).toEqual({ type: 'clear' });
    expect(actionForKeyboardEvent('c')).toEqual({ type: 'clear' });
    expect(actionForKeyboardEvent('C')).toEqual({ type: 'clear' });
    expect(actionForKeyboardEvent('Delete')).toEqual({ type: 'clearEntry' });
    expect(actionForKeyboardEvent('Backspace')).toEqual({ type: 'backspace' });
    expect(actionForKeyboardEvent('%')).toEqual({ type: 'percent' });
    expect(actionForKeyboardEvent('F9')).toEqual({ type: 'toggleSign' });
  });

  it('возвращает null для неподдерживаемых клавиш', () => {
    expect(actionForKeyboardEvent('q')).toBeNull();
    expect(actionForKeyboardEvent('F1')).toBeNull();
    expect(actionForKeyboardEvent('Shift')).toBeNull();
    expect(actionForKeyboardEvent('Tab')).toBeNull();
    expect(actionForKeyboardEvent('ArrowUp')).toBeNull();
    expect(actionForKeyboardEvent('')).toBeNull();
  });

  it('содержит оператор-действия только из контракта операторов', () => {
    const operators = Object.values(KEYBOARD_ACTIONS)
      .filter((action): action is Extract<CalculatorAction, { type: 'operator' }> => action.type === 'operator')
      .map((action) => action.operator);
    expect(operators.length).toBeGreaterThan(0);
    for (const operator of operators) {
      expect(OPERATORS).toContain(operator);
    }
  });
});
