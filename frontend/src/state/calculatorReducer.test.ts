import { describe, expect, it } from 'vitest';

import type { CalculationResult } from '../api/types';
import {
  calculatorReducer,
  initialCalculatorState,
  selectCalculationRequest,
  selectExpression,
  type CalculatorAction,
  type CalculatorState,
} from './calculatorReducer';

const SYMBOLS = { add: '+', subtract: '-', multiply: '×', divide: '÷' } as const;

function reduce(state: CalculatorState, ...actions: CalculatorAction[]): CalculatorState {
  return actions.reduce(calculatorReducer, state);
}

function digits(entry: string): CalculatorAction[] {
  return entry.split('').map((digit) => ({ type: 'digit', digit }) as CalculatorAction);
}

const ADD_RESULT: CalculationResult = {
  operation: 'add',
  operands: [2, 2],
  result: 4,
  result_text: '4',
  expression: '2 + 2',
  precision: 12,
};

describe('calculatorReducer: ввод', () => {
  it('набирает число по цифрам', () => {
    const state = reduce(initialCalculatorState, ...digits('12'));
    expect(state.entry).toBe('12');
    expect(state.error).toBeNull();
  });

  it('начинает новый операнд после нажатия операции', () => {
    let state = reduce(initialCalculatorState, ...digits('12'), { type: 'operation', operation: 'add' });
    expect(state.firstOperand).toBe('12');
    expect(state.operation).toBe('add');
    expect(state.awaitingOperand).toBe(true);

    state = reduce(state, ...digits('3'));
    expect(state.entry).toBe('3');
    expect(state.awaitingOperand).toBe(false);
  });

  it('меняет операцию, если новый операнд не вводили', () => {
    const state = reduce(
      initialCalculatorState,
      ...digits('12'),
      { type: 'operation', operation: 'add' },
      { type: 'operation', operation: 'multiply' },
    );
    expect(state.firstOperand).toBe('12');
    expect(state.operation).toBe('multiply');
  });

  it('поддерживает точку, знак и удаление символа', () => {
    const state = reduce(
      initialCalculatorState,
      { type: 'digit', digit: '3' },
      { type: 'decimal' },
      { type: 'digit', digit: '5' },
      { type: 'sign' },
      { type: 'backspace' },
    );
    expect(state.entry).toBe('-3.');
  });

  it('игнорирует ввод во время запроса', () => {
    const busy = reduce(initialCalculatorState, ...digits('12'), { type: 'request-start' });
    const next = reduce(busy, { type: 'digit', digit: '9' });
    expect(next.entry).toBe('12');
  });
});

describe('calculatorReducer: вычисление', () => {
  it('формирует запрос к backend по контракту', () => {
    const state = reduce(
      initialCalculatorState,
      ...digits('2'),
      { type: 'operation', operation: 'add' },
      ...digits('2'),
    );
    expect(selectCalculationRequest(state)).toEqual({ operation: 'add', operands: [2, 2] });
  });

  it('не формирует запрос без операции или второго операнда', () => {
    expect(selectCalculationRequest(initialCalculatorState)).toBeNull();
    const onlyOperator = reduce(initialCalculatorState, ...digits('5'), { type: 'operation', operation: 'add' });
    expect(selectCalculationRequest(onlyOperator)).toBeNull();
  });

  it('сохраняет результат и очищает операнды после успеха', () => {
    const state = reduce(
      initialCalculatorState,
      ...digits('2'),
      { type: 'operation', operation: 'add' },
      ...digits('2'),
      { type: 'request-start' },
      { type: 'request-success', result: ADD_RESULT },
    );
    expect(state.entry).toBe('4');
    expect(state.result).toEqual(ADD_RESULT);
    expect(state.firstOperand).toBeNull();
    expect(state.operation).toBeNull();
    expect(state.busy).toBe(false);
    expect(state.error).toBeNull();
  });

  it('показывает ошибку backend и сохраняет ввод', () => {
    const state = reduce(
      initialCalculatorState,
      ...digits('8'),
      { type: 'operation', operation: 'divide' },
      { type: 'digit', digit: '0' },
      { type: 'request-start' },
      { type: 'request-error', message: 'Деление на ноль недопустимо' },
    );
    expect(state.error).toBe('Деление на ноль недопустимо');
    expect(state.busy).toBe(false);
    expect(state.entry).toBe('0');
    expect(selectCalculationRequest(state)).toEqual({ operation: 'divide', operands: [8, 0] });
  });

  it('после результата использует его как левый операнд', () => {
    let state = reduce(initialCalculatorState, { type: 'request-success', result: ADD_RESULT });
    state = reduce(state, { type: 'operation', operation: 'multiply' }, ...digits('3'));
    expect(state.firstOperand).toBe('4');
    expect(selectCalculationRequest(state)).toEqual({ operation: 'multiply', operands: [4, 3] });
  });
});

describe('calculatorReducer: служебные действия', () => {
  it('AC сбрасывает состояние', () => {
    const state = reduce(
      initialCalculatorState,
      ...digits('12'),
      { type: 'operation', operation: 'add' },
      { type: 'request-error', message: 'Ошибка' },
      { type: 'clear' },
    );
    expect(state).toEqual({ ...initialCalculatorState, busy: false });
  });

  it('загружает значение из истории', () => {
    const state = reduce(initialCalculatorState, ...digits('12'), { type: 'load-value', value: '0.333333333333' });
    expect(state.entry).toBe('0.333333333333');
    expect(state.operation).toBeNull();
    expect(state.result).toBeNull();
  });
});

describe('selectExpression', () => {
  it('пусто, пока операция не выбрана', () => {
    expect(selectExpression(initialCalculatorState, SYMBOLS)).toBe('');
  });

  it('показывает незавершённое выражение', () => {
    const state = reduce(initialCalculatorState, ...digits('12'), { type: 'operation', operation: 'divide' });
    expect(selectExpression(state, SYMBOLS)).toBe('12 ÷');
  });

  it('показывает выражение выполненной операции', () => {
    const state = reduce(initialCalculatorState, { type: 'request-success', result: ADD_RESULT });
    expect(selectExpression(state, SYMBOLS)).toBe('2 + 2');
  });
});
