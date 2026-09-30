/**
 * Доменное ядро сервиса frontend «calculator-test-app».
 *
 * Модуль является источником правды о вычислениях (см. docs/contracts/frontend.md):
 * состояние неизменяемо, переходы описаны чистым редьюсером `reduce`,
 * побочных эффектов, обращений к DOM и к сети здесь нет.
 */

/** Символы операторов, поддерживаемые калькулятором. */
export const OPERATORS = ['+', '-', '×', '÷'] as const;

/** Оператор бинарной операции. */
export type Operator = (typeof OPERATORS)[number];

/** Десятичные цифры, допустимые на вводе. */
export const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

/** Одна цифра ввода. */
export type Digit = (typeof DIGITS)[number];

/** Текст дисплея в начальном состоянии и после сброса. */
export const INITIAL_DISPLAY = '0';

/** Текст дисплея в состоянии ошибки (деление на ноль, переполнение). */
export const ERROR_TEXT = 'Error';

/** Максимальное количество цифр в одном вводимом числе. */
export const MAX_ENTRY_DIGITS = 16;

/** Максимальное количество значащих цифр при выводе результата. */
export const MAX_SIGNIFICANT_DIGITS = 12;

/** Верхняя граница обычной записи; выше — экспоненциальная. */
export const EXPONENTIAL_UPPER_BOUND = 1e12;

/** Нижняя граница обычной записи; ниже — экспоненциальная. */
export const EXPONENTIAL_LOWER_BOUND = 1e-9;

/**
 * Полное состояние калькулятора.
 *
 * `display` — единственное поле, которое контракт разрешает показывать пользователю
 * как «текущее значение». Остальные поля описывают контекст вычисления.
 */
export interface CalculatorState {
  /** Текущая строка дисплея (`'0'`, `'-12.5'`, `'1.5e+12'`, `'Error'`). */
  readonly display: string;
  /** Накопленный левый операнд незавершённой операции. */
  readonly accumulator: number | null;
  /** Ожидающий оператор незавершённой операции. */
  readonly pendingOperator: Operator | null;
  /** Вводимое пользователем число как строка; `null` — на дисплее результат вычисления. */
  readonly entry: string | null;
  /** Операция последнего `equals` для повторного выполнения по повторному нажатию `=`. */
  readonly repeat: { readonly operator: Operator; readonly operand: number } | null;
  /** Признак состояния ошибки: вычисления игнорируются до сброса. */
  readonly error: boolean;
}

/** Команды, которые принимает редьюсер. */
export type CalculatorAction =
  | { readonly type: 'digit'; readonly digit: Digit }
  | { readonly type: 'decimal' }
  | { readonly type: 'operator'; readonly operator: Operator }
  | { readonly type: 'equals' }
  | { readonly type: 'clear' }
  | { readonly type: 'clearEntry' }
  | { readonly type: 'backspace' }
  | { readonly type: 'toggleSign' }
  | { readonly type: 'percent' };

/** Начальное состояние: дисплей `0`, вычисление не начато. */
export const INITIAL_STATE: CalculatorState = Object.freeze({
  display: INITIAL_DISPLAY,
  accumulator: null,
  pendingOperator: null,
  entry: null,
  repeat: null,
  error: false,
});

/** Состояние ошибки. */
export const ERROR_STATE: CalculatorState = Object.freeze({
  display: ERROR_TEXT,
  accumulator: null,
  pendingOperator: null,
  entry: null,
  repeat: null,
  error: true,
});

/** Проверка, что строка является допустимой цифрой ввода. */
export function isDigit(value: string): value is Digit {
  return (DIGITS as readonly string[]).includes(value);
}


/**
 * Вычисляет результат бинарной операции.
 * Деление на ноль возвращает `NaN` — редьюсер переводит такое состояние в ошибку.
 */
export function evaluate(left: number, right: number, operator: Operator): number {
  switch (operator) {
    case '+':
      return left + right;
    case '-':
      return left - right;
    case '×':
      return left * right;
    case '÷':
      return right === 0 ? Number.NaN : left / right;
    default:
      return Number.NaN;
  }
}

/**
 * Форматирует число для дисплея.
 * Нефинитные значения (`NaN`, `±Infinity`) форматируются как {@link ERROR_TEXT}.
 */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return ERROR_TEXT;
  }
  if (value === 0) {
    return INITIAL_DISPLAY;
  }
  const magnitude = Math.abs(value);
  if (magnitude >= EXPONENTIAL_UPPER_BOUND || magnitude < EXPONENTIAL_LOWER_BOUND) {
    return toExponentialText(value);
  }
  const precise = value.toPrecision(MAX_SIGNIFICANT_DIGITS);
  return precise.includes('e') ? toExponentialText(value) : stripTrailingZeros(precise);
}

/** Строка незавершённого выражения для дополнительной строки дисплея (`'12 +'`). */
export function formatExpression(state: CalculatorState): string {
  if (state.error || state.accumulator === null || state.pendingOperator === null) {
    return '';
  }
  return `${formatNumber(state.accumulator)} ${state.pendingOperator}`;
}

/**
 * Чистый редьюсер: `(state, action) => state`.
 * Возвращает новый объект состояния либо тот же самый, если действие не меняет состояние.
 */
export function reduce(state: CalculatorState, action: CalculatorAction): CalculatorState {
  switch (action.type) {
    case 'digit':
      return applyDigit(state, action.digit);
    case 'decimal':
      return applyDecimal(state);
    case 'operator':
      return applyOperator(state, action.operator);
    case 'equals':
      return applyEquals(state);
    case 'clear':
      return INITIAL_STATE;
    case 'clearEntry':
      return applyClearEntry(state);
    case 'backspace':
      return applyBackspace(state);
    case 'toggleSign':
      return applyToggleSign(state);
    case 'percent':
      return applyPercent(state);
    default:
      return state;
  }
}

/** Убирает незначащие нули в дробной части (`'1.2300'` → `'1.23'`). */
function stripTrailingZeros(text: string): string {
  return text.includes('.') ? text.replace(/\.?0+$/, '') : text;
}

/** Экспоненциальная запись с {@link MAX_SIGNIFICANT_DIGITS} значащими цифрами и без лишних нулей. */
function toExponentialText(value: number): string {
  const [mantissa = INITIAL_DISPLAY, exponent = '0'] = value
    .toExponential(MAX_SIGNIFICANT_DIGITS - 1)
    .split('e');
  return `${stripTrailingZeros(mantissa)}e${exponent}`;
}

/** Переводит строку ввода в число; неполные строки (`''`, `'-'`, `'0.'`) трактуются как 0. */
function toNumber(text: string): number {
  return text === '' || text === '-' ? 0 : Number(text);
}

/** Заменяет текущий ввод готовым числом. */
function startEntry(state: CalculatorState, entry: string): CalculatorState {
  return { ...state, entry, display: entry, repeat: null, error: false };
}

/** Количество цифр в строке ввода (минус и точка не считаются). */
function digitCount(entry: string): number {
  let count = 0;
  for (const char of entry) {
    if (isDigit(char)) {
      count += 1;
    }
  }
  return count;
}

/**
 * Признак того, что ввод получен из вычисленного результата (экспоненциальная запись),
 * а не набран пользователем: такой ввод нельзя продолжать цифрами.
 */
function isComputedEntry(entry: string): boolean {
  return entry.includes('e');
}

function applyDigit(state: CalculatorState, digit: Digit): CalculatorState {
  if (state.error) {
    return startEntry(INITIAL_STATE, digit);
  }
  if (state.entry === null || isComputedEntry(state.entry) || state.entry === '-') {
    return startEntry(state, digit);
  }
  if (digitCount(state.entry) >= MAX_ENTRY_DIGITS) {
    return state;
  }
  const next = state.entry === INITIAL_DISPLAY ? digit : `${state.entry}${digit}`;
  return startEntry(state, next);
}

function applyDecimal(state: CalculatorState): CalculatorState {
  if (state.error) {
    return startEntry(INITIAL_STATE, `${INITIAL_DISPLAY}.`);
  }
  if (state.entry === null || isComputedEntry(state.entry)) {
    return startEntry(state, `${INITIAL_DISPLAY}.`);
  }
  if (state.entry.includes('.')) {
    return state;
  }
  return startEntry(state, `${state.entry}.`);
}

function applyOperator(state: CalculatorState, operator: Operator): CalculatorState {
  if (state.error) {
    return state;
  }
  const { accumulator, entry, pendingOperator } = state;
  if (pendingOperator !== null && entry !== null && accumulator !== null) {
    const result = evaluate(accumulator, toNumber(entry), pendingOperator);
    if (!Number.isFinite(result)) {
      return ERROR_STATE;
    }
    return {
      display: formatNumber(result),
      accumulator: result,
      pendingOperator: operator,
      entry: null,
      repeat: null,
      error: false,
    };
  }
  const value = entry !== null ? toNumber(entry) : accumulator ?? 0;
  if (!Number.isFinite(value)) {
    return ERROR_STATE;
  }
  return {
    display: formatNumber(value),
    accumulator: value,
    pendingOperator: operator,
    entry: null,
    repeat: null,
    error: false,
  };
}

function applyEquals(state: CalculatorState): CalculatorState {
  if (state.error) {
    return state;
  }
  const { accumulator, entry, pendingOperator, repeat } = state;
  if (pendingOperator !== null && accumulator !== null) {
    const operand = entry !== null ? toNumber(entry) : accumulator;
    const result = evaluate(accumulator, operand, pendingOperator);
    if (!Number.isFinite(result)) {
      return ERROR_STATE;
    }
    return {
      display: formatNumber(result),
      accumulator: result,
      pendingOperator: null,
      entry: null,
      repeat: { operator: pendingOperator, operand },
      error: false,
    };
  }
  if (repeat !== null) {
    const left = accumulator ?? toNumber(state.display);
    const result = evaluate(left, repeat.operand, repeat.operator);
    if (!Number.isFinite(result)) {
      return ERROR_STATE;
    }
    return {
      display: formatNumber(result),
      accumulator: result,
      pendingOperator: null,
      entry: null,
      repeat,
      error: false,
    };
  }
  const value = entry !== null ? toNumber(entry) : accumulator ?? toNumber(state.display);
  if (!Number.isFinite(value)) {
    return ERROR_STATE;
  }
  return {
    display: formatNumber(value),
    accumulator: value,
    pendingOperator: null,
    entry: null,
    repeat: null,
    error: false,
  };
}

function applyClearEntry(state: CalculatorState): CalculatorState {
  if (state.error) {
    return INITIAL_STATE;
  }
  return { ...state, display: INITIAL_DISPLAY, entry: INITIAL_DISPLAY, repeat: null };
}

function applyBackspace(state: CalculatorState): CalculatorState {
  if (state.error) {
    return INITIAL_STATE;
  }
  if (state.entry === null || isComputedEntry(state.entry)) {
    return state;
  }
  const trimmed = state.entry.slice(0, -1);
  const next = trimmed === '' || trimmed === '-' ? INITIAL_DISPLAY : trimmed;
  return { ...state, display: next, entry: next };
}

function applyToggleSign(state: CalculatorState): CalculatorState {
  if (state.error) {
    return INITIAL_STATE;
  }
  if (state.entry === null || isComputedEntry(state.entry)) {
    const value =
      state.entry !== null ? toNumber(state.entry) : state.accumulator ?? toNumber(state.display);
    const next = formatNumber(-value);
    return { ...state, display: next, entry: next, repeat: null };
  }
  const next = state.entry.startsWith('-')
    ? state.entry.slice(1)
    : state.entry === INITIAL_DISPLAY
      ? INITIAL_DISPLAY
      : `-${state.entry}`;
  return { ...state, display: next, entry: next, repeat: null };
}

function applyPercent(state: CalculatorState): CalculatorState {
  if (state.error) {
    return INITIAL_STATE;
  }
  const { accumulator, entry, pendingOperator } = state;
  const value = entry !== null ? toNumber(entry) : accumulator ?? toNumber(state.display);
  const isRelative = pendingOperator !== null && accumulator !== null;
  const result = isRelative ? (accumulator * value) / 100 : value / 100;
  if (!Number.isFinite(result)) {
    return ERROR_STATE;
  }
  const next = formatNumber(result);
  return { ...state, display: next, entry: next, repeat: null };
}
