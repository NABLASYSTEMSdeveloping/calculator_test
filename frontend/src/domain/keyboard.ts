/**
 * Адаптер клавиатуры: перевод `KeyboardEvent.key` в действие калькулятора.
 * Признак «нет действия» — `null`; такие клавиши сервис не перехватывает.
 */
import { isDigit } from './calculator';
import type { CalculatorAction } from './calculator';

/**
 * Карта клавиш, не являющихся цифрами.
 * Ключ — значение `KeyboardEvent.key`.
 */
export const KEYBOARD_ACTIONS: Readonly<Record<string, CalculatorAction>> = Object.freeze({
  '.': { type: 'decimal' },
  ',': { type: 'decimal' },
  '+': { type: 'operator', operator: '+' },
  '-': { type: 'operator', operator: '-' },
  '*': { type: 'operator', operator: '×' },
  '×': { type: 'operator', operator: '×' },
  '/': { type: 'operator', operator: '÷' },
  '÷': { type: 'operator', operator: '÷' },
  '=': { type: 'equals' },
  Enter: { type: 'equals' },
  Escape: { type: 'clear' },
  c: { type: 'clear' },
  C: { type: 'clear' },
  Delete: { type: 'clearEntry' },
  Backspace: { type: 'backspace' },
  '%': { type: 'percent' },
  F9: { type: 'toggleSign' },
});

/** Возвращает действие для нажатой клавиши или `null`, если клавиша не поддерживается. */
export function actionForKeyboardEvent(key: string): CalculatorAction | null {
  if (isDigit(key)) {
    return { type: 'digit', digit: key };
  }
  return KEYBOARD_ACTIONS[key] ?? null;
}
