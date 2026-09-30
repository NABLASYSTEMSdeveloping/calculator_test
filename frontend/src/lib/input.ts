/**
 * Правила ввода операнда (см. services/calculator-test-app/CONTRACT.md, раздел 4.2).
 * Никакой арифметики: только формирование и валидация строки ввода.
 */

export const MAX_INPUT_DIGITS = 16;

const ENTRY_PATTERN = /^-?(\d+(\.\d*)?|\.\d+)$/;

export function countDigits(entry: string): number {
  return (entry.match(/\d/g) ?? []).length;
}

export function isEntryComplete(entry: string): boolean {
  return ENTRY_PATTERN.test(entry);
}

export function toNumber(entry: string): number | null {
  if (!isEntryComplete(entry)) {
    return null;
  }
  const value = Number(entry);
  return Number.isFinite(value) ? value : null;
}

export function appendDigit(entry: string, digit: string): string {
  if (!/^[0-9]$/.test(digit)) {
    return entry;
  }
  if (countDigits(entry) >= MAX_INPUT_DIGITS) {
    return entry;
  }
  if (entry === '0') {
    return digit === '0' ? '0' : digit;
  }
  if (entry === '-0') {
    return digit === '0' ? '-0' : `-${digit}`;
  }
  return `${entry}${digit}`;
}

export function appendDecimal(entry: string): string {
  if (entry.includes('.')) {
    return entry;
  }
  if (entry === '0' || entry === '') {
    return '0.';
  }
  if (entry === '-0' || entry === '-') {
    return '-0.';
  }
  return `${entry}.`;
}

export function toggleSign(entry: string): string {
  const magnitude = entry.startsWith('-') ? entry.slice(1) : entry;
  if (/^0*\.?0*$/.test(magnitude)) {
    return entry; // знак нуля не меняем
  }
  return entry.startsWith('-') ? magnitude : `-${entry}`;
}

export function removeLastChar(entry: string): string {
  const next = entry.slice(0, -1);
  if (next === '' || next === '-') {
    return '0';
  }
  return next;
}

/** Готов ли ввод к отправке на backend (число и не превышен лимит значащих цифр). */
export function canSubmit(entry: string): boolean {
  return countDigits(entry) <= MAX_INPUT_DIGITS && toNumber(entry) !== null;
}
