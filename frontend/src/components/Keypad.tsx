import type { ReactElement } from 'react';
import type { CalculatorAction } from '../domain/calculator';

/** Описание клавиши: контракт раскладки (id, подпись, действие, вариант оформления). */
export interface CalculatorKeyDefinition {
  /** Стабильный идентификатор: попадает в `data-testid="key-<id>"`. */
  readonly id: string;
  /** Текст на клавише. */
  readonly label: string;
  /** Доступное имя для скринридеров и тестов. */
  readonly ariaLabel: string;
  /** Действие, которое клавиша отправляет в редьюсер. */
  readonly action: CalculatorAction;
  /** Вариант оформления. */
  readonly variant: 'digit' | 'operator' | 'function' | 'equals';
}

/** Раскладка клавиатуры калькулятора: 5 рядов по 4 клавиши, порядок = порядок отрисовки. */
export const CALCULATOR_KEYS: readonly CalculatorKeyDefinition[] = Object.freeze([
  { id: 'clear', label: 'C', ariaLabel: 'Очистить всё', action: { type: 'clear' }, variant: 'function' },
  {
    id: 'backspace',
    label: '⌫',
    ariaLabel: 'Удалить последний символ',
    action: { type: 'backspace' },
    variant: 'function',
  },
  { id: 'percent', label: '%', ariaLabel: 'Процент', action: { type: 'percent' }, variant: 'function' },
  {
    id: 'divide',
    label: '÷',
    ariaLabel: 'Деление',
    action: { type: 'operator', operator: '÷' },
    variant: 'operator',
  },
  { id: '7', label: '7', ariaLabel: 'Семь', action: { type: 'digit', digit: '7' }, variant: 'digit' },
  { id: '8', label: '8', ariaLabel: 'Восемь', action: { type: 'digit', digit: '8' }, variant: 'digit' },
  { id: '9', label: '9', ariaLabel: 'Девять', action: { type: 'digit', digit: '9' }, variant: 'digit' },
  {
    id: 'multiply',
    label: '×',
    ariaLabel: 'Умножение',
    action: { type: 'operator', operator: '×' },
    variant: 'operator',
  },
  { id: '4', label: '4', ariaLabel: 'Четыре', action: { type: 'digit', digit: '4' }, variant: 'digit' },
  { id: '5', label: '5', ariaLabel: 'Пять', action: { type: 'digit', digit: '5' }, variant: 'digit' },
  { id: '6', label: '6', ariaLabel: 'Шесть', action: { type: 'digit', digit: '6' }, variant: 'digit' },
  {
    id: 'subtract',
    label: '-',
    ariaLabel: 'Вычитание',
    action: { type: 'operator', operator: '-' },
    variant: 'operator',
  },
  { id: '1', label: '1', ariaLabel: 'Один', action: { type: 'digit', digit: '1' }, variant: 'digit' },
  { id: '2', label: '2', ariaLabel: 'Два', action: { type: 'digit', digit: '2' }, variant: 'digit' },
  { id: '3', label: '3', ariaLabel: 'Три', action: { type: 'digit', digit: '3' }, variant: 'digit' },
  { id: 'add', label: '+', ariaLabel: 'Сложение', action: { type: 'operator', operator: '+' }, variant: 'operator' },
  {
    id: 'toggle-sign',
    label: '±',
    ariaLabel: 'Сменить знак',
    action: { type: 'toggleSign' },
    variant: 'function',
  },
  { id: '0', label: '0', ariaLabel: 'Ноль', action: { type: 'digit', digit: '0' }, variant: 'digit' },
  { id: 'decimal', label: '.', ariaLabel: 'Десятичная точка', action: { type: 'decimal' }, variant: 'digit' },
  { id: 'equals', label: '=', ariaLabel: 'Равно', action: { type: 'equals' }, variant: 'equals' },
]);

/** Свойства клавиатуры калькулятора. */
export interface KeypadProps {
  /** Единственный колбэк: клавиша передаёт своё действие наружу. */
  readonly onAction: (action: CalculatorAction) => void;
  /** Блокировка всех клавиш. */
  readonly disabled?: boolean;
}

/** Клавиатура калькулятора: рендерит {@link CALCULATOR_KEYS} и вызывает `onAction`. */
export function Keypad({ onAction, disabled = false }: KeypadProps): ReactElement {
  return (
    <div className="keypad" data-testid="keypad" role="group" aria-label="Клавиши калькулятора">
      {CALCULATOR_KEYS.map((key) => (
        <button
          key={key.id}
          type="button"
          className={`keypad__key keypad__key--${key.variant}`}
          data-testid={`key-${key.id}`}
          data-action={key.action.type}
          aria-label={key.ariaLabel}
          disabled={disabled}
          onClick={() => {
            onAction(key.action);
          }}
        >
          {key.label}
        </button>
      ))}
    </div>
  );
}
