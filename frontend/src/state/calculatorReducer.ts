/**
 * Машина состояний калькулятора (CONTRACT.md, раздел 3.1). Чистая функция без сети и арифметики.
 */

import { appendDecimal, appendDigit, canSubmit, removeLastChar, toNumber, toggleSign } from '../lib/input';
import type { CalculationResult, OperationId } from '../api/types';

export interface CalculatorState {
  entry: string;
  firstOperand: string | null;
  operation: OperationId | null;
  awaitingOperand: boolean;
  result: CalculationResult | null;
  error: string | null;
  busy: boolean;
}

export type CalculatorAction =
  | { type: 'digit'; digit: string }
  | { type: 'decimal' }
  | { type: 'backspace' }
  | { type: 'sign' }
  | { type: 'operation'; operation: OperationId }
  | { type: 'clear' }
  | { type: 'request-start' }
  | { type: 'request-success'; result: CalculationResult }
  | { type: 'request-error'; message: string }
  | { type: 'load-value'; value: string };

export const initialCalculatorState: CalculatorState = {
  entry: '0',
  firstOperand: null,
  operation: null,
  awaitingOperand: false,
  result: null,
  error: null,
  busy: false,
};

export interface PendingCalculation {
  operation: OperationId;
  operands: [number, number];
}

export function calculatorReducer(state: CalculatorState, action: CalculatorAction): CalculatorState {
  switch (action.type) {
    case 'digit': {
      if (state.busy) {
        return state;
      }
      const base = state.awaitingOperand ? '0' : state.entry;
      return {
        ...state,
        entry: appendDigit(base, action.digit),
        awaitingOperand: false,
        result: null,
        error: null,
      };
    }

    case 'decimal': {
      if (state.busy) {
        return state;
      }
      const base = state.awaitingOperand ? '0' : state.entry;
      return { ...state, entry: appendDecimal(base), awaitingOperand: false, error: null };
    }

    case 'backspace': {
      if (state.busy) {
        return state;
      }
      return { ...state, entry: removeLastChar(state.entry), error: null };
    }

    case 'sign': {
      if (state.busy) {
        return state;
      }
      return { ...state, entry: toggleSign(state.entry), error: null };
    }

    case 'operation': {
      if (state.busy) {
        return state;
      }
      const keepFirstOperand = state.awaitingOperand && state.firstOperand !== null;
      const firstOperand: string = keepFirstOperand && state.firstOperand !== null ? state.firstOperand : state.entry;
      if (!canSubmit(firstOperand)) {
        return state;
      }
      return {
        ...state,
        firstOperand,
        operation: action.operation,
        awaitingOperand: true,
        result: null,
        error: null,
      };
    }

    case 'clear':
      return { ...initialCalculatorState, busy: state.busy };

    case 'request-start':
      return { ...state, busy: true, error: null };

    case 'request-success':
      return {
        entry: action.result.result_text,
        firstOperand: null,
        operation: null,
        awaitingOperand: false,
        result: action.result,
        error: null,
        busy: false,
      };

    case 'request-error':
      return { ...state, busy: false, error: action.message };

    case 'load-value':
      return {
        ...state,
        entry: action.value,
        firstOperand: null,
        operation: null,
        awaitingOperand: false,
        result: null,
        error: null,
      };

    default:
      return state;
  }
}

/** Готовый запрос к backend или null, если вычислять нечего (нажатие `=` — no-op). */
export function selectCalculationRequest(state: CalculatorState): PendingCalculation | null {
  if (state.operation === null || state.firstOperand === null || state.awaitingOperand) {
    return null;
  }
  if (!canSubmit(state.firstOperand) || !canSubmit(state.entry)) {
    return null;
  }
  const left = toNumber(state.firstOperand);
  const right = toNumber(state.entry);
  if (left === null || right === null) {
    return null;
  }
  return { operation: state.operation, operands: [left, right] };
}

/** Подпись над дисплеем: либо результат выполненной операции, либо незавершённое выражение. */
export function selectExpression(state: CalculatorState, symbols: Record<OperationId, string>): string {
  if (state.operation !== null && state.firstOperand !== null) {
    const right = state.awaitingOperand ? '' : ` ${state.entry}`;
    return `${state.firstOperand} ${symbols[state.operation]}${right}`;
  }
  if (state.result !== null) {
    return state.result.expression;
  }
  return '';
}
