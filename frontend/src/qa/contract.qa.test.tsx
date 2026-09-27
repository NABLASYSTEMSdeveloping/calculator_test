/**
 * Независимый QA-набор для сервиса `frontend`.
 *
 * Проверяет соответствие реализации контракту `docs/contracts/frontend.md`
 * «снаружи» — только через публичные интерфейсы (доменное API, адаптер
 * клавиатуры, props виджета, DOM-хуки). Ожидаемые значения выведены из текста
 * контракта, а не из реализации.
 *
 * Результаты прогона и найденные расхождения — в отчёте `docs/qa/report.md`.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  DIGITS,
  ERROR_STATE,
  ERROR_TEXT,
  INITIAL_STATE,
  MAX_ENTRY_DIGITS,
  MAX_SIGNIFICANT_DIGITS,
  OPERATORS,
  evaluate,
  formatExpression,
  formatNumber,
  isDigit,
  reduce,
} from '../domain/calculator';
import type { CalculatorState } from '../domain/calculator';
import { KEYBOARD_ACTIONS, actionForKeyboardEvent } from '../domain/keyboard';
import { Calculator } from '../components/Calculator';
import { CALCULATOR_KEYS } from '../components/Keypad';

const KEY_SEQUENCE = /\{Backspace\}|F9|[\s\S]/g;

/** Прогоняет запись нажатий через публичные `actionForKeyboardEvent` + `reduce`. */
function pressKeys(keys: string, from: CalculatorState = INITIAL_STATE): CalculatorState {
  return (keys.match(KEY_SEQUENCE) ?? []).reduce<CalculatorState>((state, token) => {
    const key = token === '{Backspace}' ? 'Backspace' : token;
    const action = actionForKeyboardEvent(key);
    if (action === null) {
      throw new Error(`Клавиша «${key}» не поддерживается адаптером клавиатуры`);
    }
    return reduce(state, action);
  }, from);
}

/** Эталон `formatNumber`, выведенный из контракта 3.1 + 4.7 (независимый оракул). */
function contractFormatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return ERROR_TEXT;
  }
  if (value === 0) {
    return '0';
  }
  const magnitude = Math.abs(value);
  const strip = (text: string): string => (text.includes('.') ? text.replace(/\.?0+$/, '') : text);
  const exponential = (input: number): string => {
    const [mantissa = '0', exponent = '0'] = input
      .toExponential(MAX_SIGNIFICANT_DIGITS - 1)
      .split('e');
    return `${strip(mantissa)}e${exponent}`;
  };
  if (magnitude >= 1e12 || magnitude < 1e-9) {
    return exponential(value);
  }
  const precise = value.toPrecision(MAX_SIGNIFICANT_DIGITS);
  if (!precise.includes('e')) {
    return strip(precise);
  }
  const [, exponentText = '0'] = precise.split('e');
  return strip(value.toFixed(Math.max(0, MAX_SIGNIFICANT_DIGITS - 1 - Number(exponentText))));
}

describe('QA · контракт 4.1–4.5: таблицы поведения (adapter + reduce)', () => {
  it('4.1 вычисляет слева направо, без приоритетов: 2 + 3 × 4 = → 20', () => {
    expect(pressKeys('2+3*4=').display).toBe('20');
  });

  it('4.2 не накапливает ведущие нули и ограничивает ввод', () => {
    expect(pressKeys('000').display).toBe('0');
    expect(pressKeys('05').display).toBe('5');
    expect(pressKeys('.').display).toBe('0.');
    expect(pressKeys('1..2').display).toBe('1.2');
    const long = pressKeys('1'.repeat(40));
    expect(long.display).toBe('1'.repeat(MAX_ENTRY_DIGITS));
  });

  it('4.2 цифра после результата начинает новое число', () => {
    expect(pressKeys('2+3=7').display).toBe('7');
  });

  it('4.3 повторный оператор заменяется без вычисления: 5 + × → 5 ×', () => {
    const state = pressKeys('5+*');
    expect(state.display).toBe('5');
    expect(state.accumulator).toBe(5);
    expect(state.pendingOperator).toBe('×');
  });

  it('4.3 оператор после операнда завершает операцию: 2 + 3 × → 5 ×', () => {
    expect(pressKeys('2+3*').display).toBe('5');
    expect(formatExpression(pressKeys('2+3*'))).toBe('5 ×');
  });

  it('4.3 повторные «=» повторяют операцию: 2 + 3 = = = → 5, 8, 11', () => {
    expect(pressKeys('2+3=').display).toBe('5');
    expect(pressKeys('2+3==').display).toBe('8');
    expect(pressKeys('2+3===').display).toBe('11');
  });

  it('4.3 «=» без правого операнда удваивает аккумулятор: 5 + = → 10', () => {
    expect(pressKeys('5+=').display).toBe('10');
  });

  it('4.4 «%» считает процент от накопленного значения', () => {
    expect(pressKeys('200+10%').display).toBe('20');
    expect(pressKeys('200+10%=').display).toBe('220');
    expect(pressKeys('200-10%=').display).toBe('180');
    expect(pressKeys('50*10%').display).toBe('5');
    expect(pressKeys('50*10%=').display).toBe('250');
    expect(pressKeys('80/10%=').display).toBe('10');
  });

  it('4.4 «%» без оператора делит значение на 100', () => {
    expect(pressKeys('50%').display).toBe('0.5');
  });

  it('4.4 «±» меняет знак: 5 → -5, «5 + ± =» → 0, «±» от нуля → 0', () => {
    expect(reduce(pressKeys('5'), { type: 'toggleSign' }).display).toBe('-5');
    const signed = reduce(pressKeys('5+'), { type: 'toggleSign' });
    expect(pressKeys('=', signed).display).toBe('0');
    expect(reduce(INITIAL_STATE, { type: 'toggleSign' }).display).toBe('0');
  });

  it('4.5 «⌫» удаляет последний символ и не трогает результат', () => {
    expect(pressKeys('123{Backspace}').display).toBe('12');
    expect(pressKeys('1{Backspace}').display).toBe('0');
    expect(pressKeys('0.5{Backspace}').display).toBe('0.');
    expect(pressKeys('2+3={Backspace}').display).toBe('5');
  });

  it('4.5 «CE» очищает ввод, сохраняя операцию: 12 + 3, CE, 5 = → 17', () => {
    const cleared = reduce(pressKeys('12+3'), { type: 'clearEntry' });
    expect(cleared.display).toBe('0');
    expect(cleared.accumulator).toBe(12);
    expect(cleared.pendingOperator).toBe('+');
    expect(pressKeys('5=', cleared).display).toBe('17');
  });

  it('4.6 деление на ноль даёт ERROR_STATE, служебные клавиши сбрасывают', () => {
    expect(pressKeys('5/0=')).toEqual(ERROR_STATE);
    expect(reduce(ERROR_STATE, { type: 'equals' })).toBe(ERROR_STATE);
    expect(reduce(ERROR_STATE, { type: 'operator', operator: '+' })).toBe(ERROR_STATE);
    expect(reduce(pressKeys('5/0='), { type: 'clear' })).toEqual(INITIAL_STATE);
    expect(reduce(pressKeys('5/0='), { type: 'percent' })).toEqual(INITIAL_STATE);
    expect(reduce(pressKeys('5/0='), { type: 'toggleSign' })).toEqual(INITIAL_STATE);
    expect(reduce(pressKeys('5/0='), { type: 'backspace' })).toEqual(INITIAL_STATE);
    expect(reduce(pressKeys('5/0='), { type: 'clearEntry' })).toEqual(INITIAL_STATE);
    expect(pressKeys('5/0=7').display).toBe('7');
    expect(pressKeys('5/0=7').error).toBe(false);
    expect(pressKeys('5/0=.').display).toBe('0.');
  });

  it('4.6 переполнение достижимо реальным вводом и даёт ошибку', () => {
    const sequence = `${'9'.repeat(MAX_ENTRY_DIGITS)}*${'9'.repeat(MAX_ENTRY_DIGITS)}=${'='.repeat(40)}`;
    const state = pressKeys(sequence);
    expect(state.error).toBe(true);
    expect(state.display).toBe(ERROR_TEXT);
  });

  it('3.1 state неизменяем: INITIAL_STATE не мутируется', () => {
    pressKeys('1+2=');
    pressKeys('9/0=');
    expect(INITIAL_STATE).toEqual({
      display: '0',
      accumulator: null,
      pendingOperator: null,
      entry: null,
      repeat: null,
      error: false,
    });
  });

  it('3.1 evaluate: четыре операции, деление на ноль → NaN', () => {
    expect(evaluate(2, 3, '+')).toBe(5);
    expect(evaluate(2, 3, '-')).toBe(-1);
    expect(evaluate(2, 3, '×')).toBe(6);
    expect(evaluate(8, 2, '÷')).toBe(4);
    expect(evaluate(5, 0, '÷')).toBeNaN();
  });

  it('3.1 isDigit принимает ровно одну цифру 0…9', () => {
    for (const digit of DIGITS) {
      expect(isDigit(digit)).toBe(true);
    }
    expect(isDigit('12')).toBe(false);
    expect(isDigit('')).toBe(false);
  });
});


describe('QA · контракт 3.1 + 4.7: форматирование', () => {
  it('не более 12 значащих цифр и без незначащих нулей', () => {
    expect(formatNumber(0.1 + 0.2)).toBe('0.3');
    expect(formatNumber(1 / 3)).toBe('0.333333333333');
    const significant = formatNumber(1 / 3)
      .replace(/^0+\.?/, '')
      .replace(/[^0-9]/g, '');
    expect(significant).toHaveLength(MAX_SIGNIFICANT_DIGITS);
    expect(formatNumber(100)).toBe('100');
    expect(formatNumber(-12.5)).toBe('-12.5');
  });

  it('±0 → «0», нефинитные → «Error»', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(-0)).toBe('0');
    expect(formatNumber(Number.NaN)).toBe(ERROR_TEXT);
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe(ERROR_TEXT);
    expect(formatNumber(Number.NEGATIVE_INFINITY)).toBe(ERROR_TEXT);
  });

  it('экспоненциальная запись за границами [1e-9, 1e12)', () => {
    expect(formatNumber(1e12)).toBe('1e+12');
    expect(formatNumber(1.5e12)).toBe('1.5e+12');
    expect(formatNumber(1234567890123)).toBe('1.23456789012e+12');
    expect(formatNumber(1e-10)).toBe('1e-10');
    expect(formatNumber(999999999999)).toBe('999999999999');
  });

  it('formatExpression пуста без операции и в ошибке, иначе «accumulator operator»', () => {
    expect(formatExpression(INITIAL_STATE)).toBe('');
    expect(formatExpression(ERROR_STATE)).toBe('');
    expect(formatExpression(pressKeys('12'))).toBe('');
    expect(formatExpression(pressKeys('12+'))).toBe('12 +');
  });

  /**
   * QA-1 (см. docs/qa/report.md): контракт 3.1/4.7 относит значения
   * `[1e-9, 1e12)` к обычной (не экспоненциальной) записи, однако реализация
   * выдаёт экспоненциальную запись для magnitudes в `[1e-9, 1e-6)`.
   * Тест зафиксирован через `it.fails`: ожидание контракта сейчас не выполняется.
   */
  it.fails('QA-1: контракт 4.7 ожидает «0.0000001» для 1e-7', () => {
    expect(formatNumber(1e-7)).toBe('0.0000001');
  });

  it('QA-1: фактическое поведение — экспоненциальная запись в [1e-9, 1e-6)', () => {
    expect(formatNumber(1e-7)).toBe('1e-7');
    expect(formatNumber(1e-9)).toBe('1e-9');
    expect(formatNumber(5e-7)).toBe('5e-7');
  });

  it('QA-1: дифференциальная сверка с эталоном — расхождения только в [1e-9, 1e-6)', () => {
    const mantissas = [1, 1.5, 2.5, 9.99999999999];
    const outside: string[] = [];
    let inside = 0;
    for (let exponent = -12; exponent <= 16; exponent += 1) {
      for (const mantissa of mantissas) {
        const value = mantissa * 10 ** exponent;
        const actual = formatNumber(value);
        const expected = contractFormatNumber(value);
        if (actual === expected) {
          continue;
        }
        const magnitude = Math.abs(value);
        if (magnitude >= 1e-9 && magnitude < 1e-6) {
          inside += 1;
        } else {
          outside.push(`${value}: actual=${actual} expected=${expected}`);
        }
      }
    }
    expect(outside).toEqual([]);
    expect(inside).toBeGreaterThan(0);
  });
});


describe('QA · контракт 3.2: адаптер клавиатуры', () => {
  it('переводит цифры и все нецифровые клавиши таблицы 3.2', () => {
    for (const digit of DIGITS) {
      expect(actionForKeyboardEvent(digit)).toEqual({ type: 'digit', digit });
    }
    expect(actionForKeyboardEvent('.')).toEqual({ type: 'decimal' });
    expect(actionForKeyboardEvent(',')).toEqual({ type: 'decimal' });
    expect(actionForKeyboardEvent('+')).toEqual({ type: 'operator', operator: '+' });
    expect(actionForKeyboardEvent('-')).toEqual({ type: 'operator', operator: '-' });
    expect(actionForKeyboardEvent('*')).toEqual({ type: 'operator', operator: '×' });
    expect(actionForKeyboardEvent('×')).toEqual({ type: 'operator', operator: '×' });
    expect(actionForKeyboardEvent('/')).toEqual({ type: 'operator', operator: '÷' });
    expect(actionForKeyboardEvent('÷')).toEqual({ type: 'operator', operator: '÷' });
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

  it('публичная карта KEYBOARD_ACTIONS не содержит цифр', () => {
    for (const digit of DIGITS) {
      expect(KEYBOARD_ACTIONS[digit]).toBeUndefined();
    }
    expect(Object.keys(KEYBOARD_ACTIONS).length).toBeGreaterThan(0);
  });

  it('возвращает null для неподдерживаемых клавиш', () => {
    for (const key of ['q', 'F1', 'Shift', 'Tab', 'ArrowUp', '']) {
      expect(actionForKeyboardEvent(key)).toBeNull();
    }
  });

  it('операторы адаптера входят в OPERATORS', () => {
    for (const action of Object.values(KEYBOARD_ACTIONS)) {
      if (action.type === 'operator') {
        expect(OPERATORS).toContain(action.operator);
      }
    }
  });
});


describe('QA · контракт 3.3 + 3.4: виджет и DOM-хуки', () => {
  it('корень — <section data-testid="calculator"> с классом calculator', () => {
    render(<Calculator />);
    const root = screen.getByTestId('calculator');
    expect(root.tagName).toBe('SECTION');
    expect(root).toHaveClass('calculator');
  });

  it('раскладка — 20 клавиш в порядке контракта, с type/aria-label/data-action', () => {
    render(<Calculator />);
    const expectedIds = [
      'clear', 'backspace', 'percent', 'divide',
      '7', '8', '9', 'multiply',
      '4', '5', '6', 'subtract',
      '1', '2', '3', 'add',
      'toggle-sign', '0', 'decimal', 'equals',
    ];
    expect(CALCULATOR_KEYS.map((key) => key.id)).toEqual(expectedIds);
    expect(screen.queryByTestId('key-enter')).toBeNull();
    expect(screen.queryByTestId('key-ce')).toBeNull();
    for (const key of CALCULATOR_KEYS) {
      const button = screen.getByTestId(`key-${key.id}`);
      expect(button.tagName).toBe('BUTTON');
      expect(button).toHaveAttribute('type', 'button');
      expect(button).toHaveAttribute('aria-label', key.ariaLabel);
      expect(button).toHaveAttribute('data-action', key.action.type);
    }
  });

  it('дисплей, выражение и клавиатура имеют контрактные роли и атрибуты', async () => {
    const user = userEvent.setup();
    render(<Calculator />);

    expect(screen.getByTestId('keypad')).toHaveAttribute('role', 'group');
    expect(screen.getByTestId('keypad')).toHaveAttribute('aria-label', 'Клавиши калькулятора');
    expect(screen.getByTestId('expression').textContent).toBe('\u00a0');

    const output = screen.getByTestId('display-value');
    expect(output).toHaveAttribute('role', 'status');
    expect(output).toHaveAttribute('aria-live', 'polite');
    expect(output).toHaveAttribute('aria-label', 'Результат вычислений');
    expect(output).toHaveAttribute('data-state', 'ok');

    await user.click(screen.getByTestId('key-7'));
    await user.click(screen.getByTestId('key-multiply'));
    expect(screen.getByTestId('expression').textContent).toBe('7 ×');

    await user.click(screen.getByTestId('key-clear'));
    await user.click(screen.getByTestId('key-5'));
    await user.click(screen.getByTestId('key-divide'));
    await user.click(screen.getByTestId('key-0'));
    await user.click(screen.getByTestId('key-equals'));
    expect(output).toHaveAttribute('data-state', 'error');
    expect(screen.getByTestId('calculator')).toHaveClass('calculator--error');
  });

  it('перехватывает поддерживаемые клавиши и не трогает неподдерживаемые', () => {
    render(<Calculator />);
    expect(fireEvent.keyDown(window, { key: '5' })).toBe(false);
    expect(screen.getByTestId('display-value').textContent).toBe('5');
    expect(fireEvent.keyDown(window, { key: 'q' })).toBe(true);
  });
});


describe('QA · контракт 3.3: props виджета', () => {
  it('не перехватывает клавиши из полей ввода', async () => {
    const user = userEvent.setup();
    render(
      <>
        <input aria-label="Поле" />
        <Calculator />
      </>,
    );
    const field = screen.getByLabelText('Поле');
    await user.click(field);
    await user.type(field, '42');
    expect(field).toHaveValue('42');
    expect(screen.getByTestId('display-value').textContent).toBe('0');
  });

  it('className добавляется, initialState действует только при первом рендере', () => {
    const { rerender } = render(
      <Calculator className="extra" initialState={{ ...INITIAL_STATE, display: '42' }} />,
    );
    expect(screen.getByTestId('calculator')).toHaveClass('calculator', 'extra');
    expect(screen.getByTestId('display-value').textContent).toBe('42');

    rerender(<Calculator className="extra" initialState={{ ...INITIAL_STATE, display: '99' }} />);
    expect(screen.getByTestId('display-value').textContent).toBe('42');
  });

  it('enableKeyboard={false} отключает перехват клавиатуры', () => {
    render(<Calculator enableKeyboard={false} />);
    expect(fireEvent.keyDown(window, { key: '5' })).toBe(true);
    expect(screen.getByTestId('display-value').textContent).toBe('0');
  });

  it('onChange вызывается на первом рендере и при каждом изменении состояния', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<Calculator onChange={onChange} />);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(INITIAL_STATE);

    rerender(<Calculator onChange={onChange} />);
    expect(onChange).toHaveBeenCalledTimes(1);

    await user.click(screen.getByTestId('key-1'));
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange.mock.calls[1]?.[0].display).toBe('1');
  });

  it('клавиши Delete и F9 дают clearEntry и toggleSign', async () => {
    const user = userEvent.setup();
    render(<Calculator />);
    await user.keyboard('12+3{Delete}5{Enter}');
    expect(screen.getByTestId('display-value').textContent).toBe('17');
    await user.keyboard('{Escape}{F9}');
    expect(screen.getByTestId('display-value').textContent).toBe('0');
  });
});

