import { describe, expect, it } from 'vitest';
import {
  ERROR_STATE,
  ERROR_TEXT,
  INITIAL_STATE,
  MAX_ENTRY_DIGITS,
  evaluate,
  formatExpression,
  formatNumber,
  isDigit,
  reduce,
} from './calculator';
import type { CalculatorState } from './calculator';
import { actionForKeyboardEvent } from './keyboard';

/**
 * Разбивает запись нажатий на токены: `{Имя}` — служебная клавиша (`{Backspace}`),
 * `F9` — смена знака, любой другой символ — одиночная клавиша.
 */
const KEY_SEQUENCE = /\{Backspace\}|F9|[\s\S]/g;

/** Псевдонимы токенов записи нажатий к значениям `KeyboardEvent.key`. */
const KEY_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  '{Backspace}': 'Backspace',
});

/**
 * Прогоняет последовательность нажатий через публичные интерфейсы сервиса:
 * адаптер клавиатуры (`actionForKeyboardEvent`) + редьюсер (`reduce`).
 */
function pressKeys(keys: string, from: CalculatorState = INITIAL_STATE): CalculatorState {
  return (keys.match(KEY_SEQUENCE) ?? []).reduce<CalculatorState>((state, token) => {
    const key = KEY_ALIASES[token] ?? token;
    const action = actionForKeyboardEvent(key);
    if (action === null) {
      throw new Error(`Клавиша «${key}» не поддерживается адаптером клавиатуры`);
    }
    return reduce(state, action);
  }, from);
}

/** Действия для клавиш, которые нельзя выразить одним символом. */
const pressBackspace = (state: CalculatorState): CalculatorState => reduce(state, { type: 'backspace' });
const pressClearEntry = (state: CalculatorState): CalculatorState => reduce(state, { type: 'clearEntry' });
const toggleSign = (state: CalculatorState): CalculatorState => reduce(state, { type: 'toggleSign' });

describe('INITIAL_STATE', () => {
  it('описывает чистое состояние калькулятора', () => {
    expect(INITIAL_STATE).toEqual({
      display: '0',
      accumulator: null,
      pendingOperator: null,
      entry: null,
      repeat: null,
      error: false,
    });
  });

  it('не изменяется редьюсером (immutable)', () => {
    pressKeys('1+2=');
    pressKeys('9/0=');
    expect(INITIAL_STATE.display).toBe('0');
    expect(INITIAL_STATE.accumulator).toBeNull();
    expect(INITIAL_STATE.error).toBe(false);
  });
});

describe('ввод числа', () => {
  it('набирает многозначное число', () => {
    expect(pressKeys('123').display).toBe('123');
    expect(pressKeys('123').entry).toBe('123');
  });

  it('не оставляет ведущих нулей', () => {
    expect(pressKeys('000').display).toBe('0');
    expect(pressKeys('05').display).toBe('5');
  });

  it('вводит десятичную точку', () => {
    expect(pressKeys('.').display).toBe('0.');
    expect(pressKeys('.5').display).toBe('0.5');
    expect(pressKeys('0.5').display).toBe('0.5');
  });

  it('игнорирует повторную десятичную точку', () => {
    expect(pressKeys('1..2').display).toBe('1.2');
    expect(pressKeys('1.2.3').display).toBe('1.23');
  });

  it(`ограничивает ввод ${MAX_ENTRY_DIGITS} цифрами`, () => {
    const state = pressKeys('1'.repeat(40));
    expect(state.display).toHaveLength(MAX_ENTRY_DIGITS);
    expect(state.display).toBe('1'.repeat(MAX_ENTRY_DIGITS));
  });

  it('начинает новый ввод после вычисления результата', () => {
    expect(pressKeys('2+3=7').display).toBe('7');
    expect(pressKeys('2+3=7+1=').display).toBe('8');
  });
});

describe('операторы', () => {
  it('запоминает левый операнд и ожидающий оператор', () => {
    const state = pressKeys('12+');
    expect(state.display).toBe('12');
    expect(state.accumulator).toBe(12);
    expect(state.pendingOperator).toBe('+');
    expect(state.entry).toBeNull();
    expect(formatExpression(state)).toBe('12 +');
  });

  it('считает слева направо, без приоритетов операций', () => {
    expect(pressKeys('2+3*').display).toBe('5');
    expect(pressKeys('2+3*4=').display).toBe('20');
  });

  it('заменяет оператор при повторном нажатии', () => {
    const state = pressKeys('5+*');
    expect(state.pendingOperator).toBe('×');
    expect(state.accumulator).toBe(5);
    expect(state.display).toBe('5');
  });

  it('работает со всеми операторами контракта', () => {
    expect(pressKeys('2+3=').display).toBe('5');
    expect(pressKeys('5-8=').display).toBe('-3');
    expect(pressKeys('6*7=').display).toBe('42');
    expect(pressKeys('8/2=').display).toBe('4');
  });

  it('игнорирует оператор в состоянии ошибки', () => {
    expect(pressKeys('5/0=+').display).toBe(ERROR_TEXT);
    expect(pressKeys('5/0=+').error).toBe(true);
  });
});

describe('клавиша «=»', () => {
  it('завершает операцию и очищает строку выражения', () => {
    const state = pressKeys('2+3=');
    expect(state.display).toBe('5');
    expect(state.accumulator).toBe(5);
    expect(state.pendingOperator).toBeNull();
    expect(state.entry).toBeNull();
    expect(formatExpression(state)).toBe('');
  });

  it('повторяет последнюю операцию при повторных нажатиях', () => {
    expect(pressKeys('2+3==').display).toBe('8');
    expect(pressKeys('2+3===').display).toBe('11');
    expect(pressKeys('2+3=').repeat).toEqual({ operator: '+', operand: 3 });
  });

  it('использует накопленное значение, если правый операнд не введён', () => {
    expect(pressKeys('5+=').display).toBe('10');
  });

  it('без ожидающего оператора просто нормализует дисплей', () => {
    const state = pressKeys('7=');
    expect(state.display).toBe('7');
    expect(state.accumulator).toBe(7);
    expect(state.repeat).toBeNull();
  });
});

describe('ошибки', () => {
  it('деление на ноль переводит калькулятор в состояние ошибки', () => {
    expect(pressKeys('5/0=')).toEqual(ERROR_STATE);
    expect(pressKeys('0/0=').display).toBe(ERROR_TEXT);
  });

  it('переполнение диапазона тоже даёт ошибку', () => {
    const huge: CalculatorState = {
      display: '1e+308',
      accumulator: 1e308,
      pendingOperator: '×',
      entry: '1e+308',
      repeat: null,
      error: false,
    };
    expect(reduce(huge, { type: 'equals' })).toEqual(ERROR_STATE);
  });

  it('игнорирует «=» и операторы в состоянии ошибки', () => {
    expect(reduce(ERROR_STATE, { type: 'equals' })).toBe(ERROR_STATE);
    expect(reduce(ERROR_STATE, { type: 'operator', operator: '+' })).toBe(ERROR_STATE);
  });

  it('начинает новое вычисление при вводе цифры', () => {
    const state = pressKeys('5/0=7');
    expect(state.display).toBe('7');
    expect(state.error).toBe(false);
    expect(state.accumulator).toBeNull();
  });

  it('начинает новое число при вводе точки', () => {
    const state = pressKeys('5/0=.');
    expect(state.display).toBe('0.');
    expect(state.error).toBe(false);
    expect(pressKeys('5', state).display).toBe('0.5');
  });

  it('сбрасывается по «C» и служебным клавишам', () => {
    expect(pressKeys('5/0=C')).toEqual(INITIAL_STATE);
    expect(pressKeys('5/0=%')).toEqual(INITIAL_STATE);
    expect(toggleSign(pressKeys('5/0='))).toEqual(INITIAL_STATE);
    expect(pressBackspace(pressKeys('5/0='))).toEqual(INITIAL_STATE);
    expect(pressClearEntry(pressKeys('5/0='))).toEqual(INITIAL_STATE);
  });
});

describe('«C» и «⌫»', () => {
  it('«C» возвращает начальное состояние', () => {
    expect(pressKeys('12+3C')).toEqual(INITIAL_STATE);
  });

  it('«⌫» удаляет последний введённый символ', () => {
    expect(pressBackspace(pressKeys('123')).display).toBe('12');
    expect(pressBackspace(pressKeys('1')).display).toBe('0');
    expect(pressBackspace(pressKeys('0')).display).toBe('0');
    expect(pressBackspace(pressKeys('0.5')).display).toBe('0.');
  });

  it('«⌫» не трогает вычисленный результат', () => {
    expect(pressBackspace(pressKeys('2+3=')).display).toBe('5');
  });

  it('очистка ввода сохраняет незавершённую операцию', () => {
    const afterClearEntry = pressClearEntry(pressKeys('12+3'));
    expect(afterClearEntry.display).toBe('0');
    expect(afterClearEntry.accumulator).toBe(12);
    expect(afterClearEntry.pendingOperator).toBe('+');
    expect(pressKeys('5=', afterClearEntry).display).toBe('17');
  });
});

describe('«±» и «%»', () => {
  it('«±» меняет знак вводимого числа', () => {
    const signed = toggleSign(pressKeys('5'));
    expect(signed.display).toBe('-5');
    expect(toggleSign(signed).display).toBe('5');
    expect(toggleSign(pressKeys('0')).display).toBe('0');
    expect(toggleSign(toggleSign(toggleSign(pressKeys('5')))).display).toBe('-5');
  });

  it('«±» меняет знак накопленного значения, если ввод не начат', () => {
    const state = toggleSign(pressKeys('5+'));
    expect(state.display).toBe('-5');
    expect(state.entry).toBe('-5');
    expect(pressKeys('=', state).display).toBe('0');
  });

  it('«%» считает процент от накопленного значения для «+» и «-»', () => {
    expect(pressKeys('200+10%').display).toBe('20');
    expect(pressKeys('200+10%=').display).toBe('220');
    expect(pressKeys('200-10%=').display).toBe('180');
  });

  it('«%» считает процент от накопленного значения для «×» и «÷»', () => {
    expect(pressKeys('50*10%').display).toBe('5');
    expect(pressKeys('50*10%=').display).toBe('250');
    expect(pressKeys('80/10%=').display).toBe('10');
  });

  it('«%» без оператора делит значение на 100', () => {
    expect(pressKeys('50%').display).toBe('0.5');
    expect(pressKeys('7=%').display).toBe('0.07');
  });
});

describe('formatNumber', () => {
  it('убирает погрешность двоичной арифметики', () => {
    expect(formatNumber(0.1 + 0.2)).toBe('0.3');
  });

  it('ограничивает вывод 12 значащими цифрами', () => {
    expect(formatNumber(1 / 3)).toBe('0.333333333333');
  });

  it('не выводит незначащие нули и «-0»', () => {
    expect(formatNumber(100)).toBe('100');
    expect(formatNumber(-12.5)).toBe('-12.5');
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(-0)).toBe('0');
  });

  it('переходит на экспоненциальную запись на границах диапазона', () => {
    expect(formatNumber(1e12)).toBe('1e+12');
    expect(formatNumber(1234567890123)).toBe('1.23456789012e+12');
    expect(formatNumber(1e-10)).toBe('1e-10');
    expect(formatNumber(1e-9)).toBe('1e-9');
    expect(formatNumber(999999999999)).toBe('999999999999');
  });

  it('нефинитные значения форматирует как ошибку', () => {
    expect(formatNumber(Number.NaN)).toBe(ERROR_TEXT);
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe(ERROR_TEXT);
    expect(formatNumber(Number.NEGATIVE_INFINITY)).toBe(ERROR_TEXT);
  });
});

describe('formatExpression', () => {
  it('пуста до ввода оператора и в состоянии ошибки', () => {
    expect(formatExpression(INITIAL_STATE)).toBe('');
    expect(formatExpression(ERROR_STATE)).toBe('');
    expect(formatExpression(pressKeys('12'))).toBe('');
  });

  it('показывает накопленный операнд и оператор', () => {
    expect(formatExpression(pressKeys('2+'))).toBe('2 +');
    expect(formatExpression(pressKeys('2+3*'))).toBe('5 ×');
  });
});

describe('evaluate', () => {
  it('выполняет четыре операции контракта', () => {
    expect(evaluate(2, 3, '+')).toBe(5);
    expect(evaluate(2, 3, '-')).toBe(-1);
    expect(evaluate(2, 3, '×')).toBe(6);
    expect(evaluate(8, 2, '÷')).toBe(4);
  });

  it('возвращает NaN при делении на ноль', () => {
    expect(evaluate(5, 0, '÷')).toBeNaN();
    expect(evaluate(0, 0, '÷')).toBeNaN();
  });
});

describe('isDigit', () => {
  it('принимает ровно одну десятичную цифру', () => {
    expect(isDigit('0')).toBe(true);
    expect(isDigit('7')).toBe(true);
    expect(isDigit('a')).toBe(false);
    expect(isDigit('12')).toBe(false);
    expect(isDigit('')).toBe(false);
  });
});

describe('иммутабельность состояния', () => {
  it('не мутирует переданное состояние и возвращает новый объект', () => {
    const frozen: CalculatorState = Object.freeze({ ...INITIAL_STATE });
    const next = pressKeys('1+2=', frozen);
    expect(frozen).toEqual(INITIAL_STATE);
    expect(next).not.toBe(frozen);
  });

  it('возвращает тот же объект, если действие не меняет состояние', () => {
    expect(reduce(INITIAL_STATE, { type: 'backspace' })).toBe(INITIAL_STATE);
    expect(reduce(INITIAL_STATE, { type: 'clear' })).toBe(INITIAL_STATE);
  });
});
