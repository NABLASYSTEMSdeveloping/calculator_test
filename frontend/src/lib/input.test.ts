import { describe, expect, it } from 'vitest';

import {
  MAX_INPUT_DIGITS,
  appendDecimal,
  appendDigit,
  canSubmit,
  countDigits,
  isEntryComplete,
  removeLastChar,
  toNumber,
  toggleSign,
} from './input';

describe('appendDigit', () => {
  it('добавляет цифру к вводу', () => {
    expect(appendDigit('0', '7')).toBe('7');
    expect(appendDigit('7', '2')).toBe('72');
  });

  it('не оставляет ведущих нулей', () => {
    expect(appendDigit('0', '0')).toBe('0');
    expect(appendDigit('-0', '0')).toBe('-0');
    expect(appendDigit('-0', '5')).toBe('-5');
    expect(appendDigit('1', '0')).toBe('10');
  });

  it('не превышает лимит значащих цифр', () => {
    const entry = '9'.repeat(MAX_INPUT_DIGITS);
    expect(appendDigit(entry, '9')).toBe(entry);
    expect(countDigits(appendDigit(entry, '9'))).toBe(MAX_INPUT_DIGITS);
  });

  it('игнорирует не-цифры', () => {
    expect(appendDigit('12', 'a')).toBe('12');
  });
});

describe('appendDecimal', () => {
  it('добавляет единственную точку', () => {
    expect(appendDecimal('0')).toBe('0.');
    expect(appendDecimal('12')).toBe('12.');
    expect(appendDecimal('12.')).toBe('12.');
    expect(appendDecimal('12.5')).toBe('12.5');
  });

  it('поддерживает отрицательный ввод', () => {
    expect(appendDecimal('-3')).toBe('-3.');
    expect(appendDecimal('-0')).toBe('-0.');
  });
});

describe('toggleSign', () => {
  it('меняет знак ввода', () => {
    expect(toggleSign('12')).toBe('-12');
    expect(toggleSign('-12')).toBe('12');
    expect(toggleSign('0.5')).toBe('-0.5');
  });

  it('не меняет знак нуля', () => {
    expect(toggleSign('0')).toBe('0');
    expect(toggleSign('-0.')).toBe('-0.');
  });
});

describe('removeLastChar', () => {
  it('удаляет последний символ', () => {
    expect(removeLastChar('123')).toBe('12');
    expect(removeLastChar('12.')).toBe('12');
  });

  it('возвращает 0 для пустого ввода', () => {
    expect(removeLastChar('5')).toBe('0');
    expect(removeLastChar('-')).toBe('0');
  });
});

describe('toNumber', () => {
  it('преобразует корректный ввод', () => {
    expect(toNumber('12')).toBe(12);
    expect(toNumber('-0.5')).toBe(-0.5);
    expect(toNumber('12.')).toBe(12);
  });

  it('возвращает null для незавершённого ввода', () => {
    expect(toNumber('-')).toBeNull();
    expect(toNumber('')).toBeNull();
    expect(toNumber('1.2.3')).toBeNull();
    expect(toNumber('1e3')).toBeNull();
  });
});

describe('canSubmit', () => {
  it('разрешает отправку валидного ввода в пределах лимита', () => {
    expect(canSubmit('42')).toBe(true);
    expect(canSubmit('9'.repeat(MAX_INPUT_DIGITS))).toBe(true);
  });

  it('запрещает отправку сверх лимита значащих цифр', () => {
    expect(canSubmit('9'.repeat(MAX_INPUT_DIGITS + 1))).toBe(false);
  });
});

describe('isEntryComplete', () => {
  it('принимает только числовые строки по контракту', () => {
    expect(isEntryComplete('0')).toBe(true);
    expect(isEntryComplete('.5')).toBe(true);
    expect(isEntryComplete('5.')).toBe(true);
    expect(isEntryComplete('-0.')).toBe(true);
    expect(isEntryComplete('-')).toBe(false);
  });
});
