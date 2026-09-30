/**
 * Корневой компонент калькулятора: связывает машину состояний, HTTP-клиент backend и UI.
 * Все вычисления выполняет backend — здесь только запросы по контракту.
 */

import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';

import { createApiClient, toUserMessage, type CalculatorApi } from '../api/client';
import type { HistoryEntry, OperationId, OperationInfo } from '../api/types';
import {
  calculatorReducer,
  initialCalculatorState,
  selectCalculationRequest,
  selectExpression,
} from '../state/calculatorReducer';
import { Display } from './Display';
import { HistoryPanel } from './HistoryPanel';
import { Keypad } from './Keypad';

export const HISTORY_LIMIT = 20;

/** Fallback-таблица символов: используется, если `GET /api/v1/operations` недоступен. */
export const FALLBACK_OPERATIONS: OperationInfo[] = [
  { id: 'add', symbol: '+', label: 'Сложение', arity: 2 },
  { id: 'subtract', symbol: '-', label: 'Вычитание', arity: 2 },
  { id: 'multiply', symbol: '×', label: 'Умножение', arity: 2 },
  { id: 'divide', symbol: '÷', label: 'Деление', arity: 2 },
];

export function symbolsFromOperations(operations: OperationInfo[]): Record<OperationId, string> {
  const symbols: Record<OperationId, string> = { add: '+', subtract: '-', multiply: '×', divide: '÷' };
  for (const operation of operations) {
    symbols[operation.id] = operation.symbol;
  }
  return symbols;
}

export interface CalculatorAppProps {
  /** Инъекция клиента: в тестах подставляется фейковый backend. */
  api?: CalculatorApi;
}

export function CalculatorApp({ api: providedApi }: CalculatorAppProps = {}) {
  const api = useMemo(() => providedApi ?? createApiClient(), [providedApi]);
  const [state, dispatch] = useReducer(calculatorReducer, initialCalculatorState);
  const [operations, setOperations] = useState<OperationInfo[]>(FALLBACK_OPERATIONS);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const symbols = useMemo(() => symbolsFromOperations(operations), [operations]);
  const expression = selectExpression(state, symbols);

  const refreshHistory = useCallback(async () => {
    try {
      const response = await api.history(HISTORY_LIMIT);
      setHistory(response.items);
    } catch {
      // история не критична: ошибку вычисления не подменяем
    }
  }, [api]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const loaded = await api.operations();
        if (active && loaded.length > 0) {
          setOperations(loaded);
        }
      } catch {
        // оставляем fallback-таблицу символов
      }
      await refreshHistory();
    })();
    return () => {
      active = false;
    };
  }, [api, refreshHistory]);

  const handleEquals = useCallback(async () => {
    const request = selectCalculationRequest(state);
    if (request === null) {
      return;
    }
    dispatch({ type: 'request-start' });
    try {
      const result = await api.calculate(request);
      dispatch({ type: 'request-success', result });
      await refreshHistory();
    } catch (error) {
      dispatch({ type: 'request-error', message: toUserMessage(error) });
    }
  }, [api, refreshHistory, state]);

  const handleClearHistory = useCallback(async () => {
    try {
      await api.clearHistory();
      setHistory([]);
    } catch (error) {
      dispatch({ type: 'request-error', message: toUserMessage(error) });
    }
  }, [api]);

  const handleKey = useCallback(
    (key: string) => {
      if (/^[0-9]$/.test(key)) {
        dispatch({ type: 'digit', digit: key });
        return;
      }
      switch (key) {
        case '.':
          dispatch({ type: 'decimal' });
          return;
        case 'backspace':
          dispatch({ type: 'backspace' });
          return;
        case 'sign':
          dispatch({ type: 'sign' });
          return;
        case 'clear':
          dispatch({ type: 'clear' });
          return;
        case 'add':
        case 'subtract':
        case 'multiply':
        case 'divide':
          dispatch({ type: 'operation', operation: key });
          return;
        case 'equals':
          void handleEquals();
          return;
        default:
          return;
      }
    },
    [handleEquals],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const { key } = event;
      if (/^[0-9]$/.test(key)) {
        event.preventDefault();
        handleKey(key);
        return;
      }
      switch (key) {
        case '.':
        case ',':
          event.preventDefault();
          handleKey('.');
          return;
        case '+':
          handleKey('add');
          return;
        case '-':
          handleKey('subtract');
          return;
        case '*':
        case 'x':
          handleKey('multiply');
          return;
        case '/':
          event.preventDefault();
          handleKey('divide');
          return;
        case 'Enter':
        case '=':
          event.preventDefault();
          handleKey('equals');
          return;
        case 'Escape':
        case 'Delete':
          handleKey('clear');
          return;
        case 'Backspace':
          event.preventDefault();
          handleKey('backspace');
          return;
        case 'n':
        case 'N':
          handleKey('sign');
          return;
        default:
          return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleKey]);

  return (
    <main className="app">
      <div className="app__calculator">
        <header className="app__header">
          <h1 className="app__title">Калькулятор</h1>
          <p className="app__subtitle">Вычисления выполняет сервис backend по REST API</p>
        </header>

        <Display entry={state.entry} expression={expression} />
        <Keypad symbols={symbols} disabled={state.busy} onKey={handleKey} />

        <div className="app__status">
          {state.busy && (
            <span className="app__busy" data-testid="app-busy">
              Вычисление…
            </span>
          )}
          {state.error !== null && (
            <span className="app__error" data-testid="app-error" role="alert">
              {state.error}
            </span>
          )}
        </div>
      </div>

      <HistoryPanel
        items={history}
        disabled={state.busy}
        onSelect={(item) => dispatch({ type: 'load-value', value: item.result_text })}
        onClear={() => void handleClearHistory()}
      />
    </main>
  );
}
