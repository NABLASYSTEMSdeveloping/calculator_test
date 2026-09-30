import type { ReactElement } from 'react';

/** Свойства дисплея калькулятора (публичный интерфейс компонента). */
export interface DisplayProps {
  /** Текущее значение: строка состояния `display`. */
  readonly value: string;
  /** Строка незавершённого выражения (`'12 +'`) или пустая строка. */
  readonly expression: string;
  /** Признак состояния ошибки — влияет на `data-state` и оформление. */
  readonly hasError: boolean;
}

/**
 * Дисплей: строка выражения и текущее значение.
 * Стабильные точки контракта — `data-testid` и атрибуты ARIA (см. docs/contracts/frontend.md).
 */
export function Display({ value, expression, hasError }: DisplayProps): ReactElement {
  return (
    <div className="display" data-testid="display">
      <div className="display__expression" data-testid="expression" aria-hidden={expression === ''}>
        {expression === '' ? '\u00a0' : expression}
      </div>
      <output
        className="display__value"
        data-testid="display-value"
        data-state={hasError ? 'error' : 'ok'}
        role="status"
        aria-live="polite"
        aria-label="Результат вычислений"
      >
        {value}
      </output>
    </div>
  );
}
