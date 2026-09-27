import type { OperationId } from '../api/types';

export interface KeypadProps {
  symbols: Record<OperationId, string>;
  disabled?: boolean;
  onKey: (key: string) => void;
}

const DIGIT_ROWS: string[][] = [
  ['7', '8', '9'],
  ['4', '5', '6'],
  ['1', '2', '3'],
];

/** Клавиатура калькулятора. Значения `data-key` зафиксированы контрактом (CONTRACT.md, 3.1). */
export function Keypad({ symbols, disabled = false, onKey }: KeypadProps) {
  const button = (key: string, label: string, className?: string, ariaLabel?: string) => (
    <button
      key={key}
      type="button"
      data-key={key}
      className={className ? `keypad__button ${className}` : 'keypad__button'}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onKey(key)}
    >
      {label}
    </button>
  );

  return (
    <div className="keypad" role="group" aria-label="Клавиатура калькулятора">
      <div className="keypad__row">
        {button('clear', 'AC', 'keypad__button--function', 'Очистить всё')}
        {button('backspace', '⌫', 'keypad__button--function', 'Удалить символ')}
        {button('sign', '±', 'keypad__button--function', 'Сменить знак')}
        {button('divide', symbols.divide, 'keypad__button--operation', 'Деление')}
      </div>

      {DIGIT_ROWS.map((row, index) => (
        <div className="keypad__row" key={`row-${index}`}>
          {row.map((digit) => button(digit, digit))}
          {index === 0 && button('multiply', symbols.multiply, 'keypad__button--operation', 'Умножение')}
          {index === 1 && button('subtract', symbols.subtract, 'keypad__button--operation', 'Вычитание')}
          {index === 2 && button('add', symbols.add, 'keypad__button--operation', 'Сложение')}
        </div>
      ))}

      <div className="keypad__row">
        {button('0', '0')}
        {button('.', ',', undefined, 'Десятичная точка')}
        {button('equals', '=', 'keypad__button--equals', 'Вычислить')}
      </div>
    </div>
  );
}
