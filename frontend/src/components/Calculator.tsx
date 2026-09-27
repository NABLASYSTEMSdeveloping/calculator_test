import { useCallback, useEffect, useReducer } from 'react';
import type { ReactElement } from 'react';
import { INITIAL_STATE, formatExpression, reduce } from '../domain/calculator';
import type { CalculatorAction, CalculatorState } from '../domain/calculator';
import { actionForKeyboardEvent } from '../domain/keyboard';
import { Display } from './Display';
import { Keypad } from './Keypad';

/** Свойства виджета калькулятора — публичный интерфейс сервиса frontend. */
export interface CalculatorProps {
  /**
   * Начальное состояние. Применяется только при первом рендере
   * (компонент неконтролируемый: дальше состояние живёт внутри).
   */
  readonly initialState?: CalculatorState;
  /**
   * Уведомление об изменении состояния. Вызывается после каждого изменения,
   * включая первый рендер, с актуальным состоянием.
   */
  readonly onChange?: (state: CalculatorState) => void;
  /** Перехват клавиатуры окна. По умолчанию `true`. */
  readonly enableKeyboard?: boolean;
  /** Дополнительные CSS-классы корневого элемента. */
  readonly className?: string;
}

/** Признак того, что клавиатурное событие пришло из поля ввода: такие события сервис не перехватывает. */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
}

/**
 * Калькулятор: состояние в редьюсере {@link reduce}, ввод — с клавиш и с клавиатуры.
 * Компонент не обращается к сети, к хранилищу и к другим сервисам.
 */
export function Calculator({
  initialState,
  onChange,
  enableKeyboard = true,
  className,
}: CalculatorProps): ReactElement {
  const [state, dispatch] = useReducer(reduce, initialState ?? INITIAL_STATE);

  const handleAction = useCallback((action: CalculatorAction) => {
    dispatch(action);
  }, []);

  useEffect(() => {
    onChange?.(state);
  }, [state, onChange]);

  useEffect(() => {
    if (!enableKeyboard) {
      return undefined;
    }
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (isEditableTarget(event.target)) {
        return;
      }
      const action = actionForKeyboardEvent(event.key);
      if (action === null) {
        return;
      }
      event.preventDefault();
      dispatch(action);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enableKeyboard]);

  const classNames = ['calculator', state.error ? 'calculator--error' : null, className ?? null]
    .filter((value): value is string => value !== null)
    .join(' ');

  return (
    <section className={classNames} data-testid="calculator" aria-label="Калькулятор">
      <Display value={state.display} expression={formatExpression(state)} hasError={state.error} />
      <Keypad onAction={handleAction} />
    </section>
  );
}
