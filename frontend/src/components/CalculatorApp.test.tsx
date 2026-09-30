import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ApiClientError } from '../api/client';
import type { CalculationResult } from '../api/types';
import {
  FIXTURE_ADD_RESULT,
  FIXTURE_DIVISION_ERROR,
  FIXTURE_HISTORY,
  createFakeApi,
} from '../test/fakeApi';
import { CalculatorApp } from './CalculatorApp';

/** Клавиша по контрактному `data-key` (CONTRACT.md, 3.1). */
function key(name: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(`[data-key="${name}"]`);
  if (element === null) {
    throw new Error(`Клавиша "${name}" не найдена в разметке`);
  }
  return element;
}

function result42(): CalculationResult {
  return {
    operation: 'multiply',
    operands: [7, 6],
    result: 42,
    result_text: '42',
    expression: '7 × 6',
    precision: 12,
  };
}

describe('CalculatorApp: начальное состояние', () => {
  it('показывает нулевой ввод и пустую историю', async () => {
    const { api } = createFakeApi();
    render(<CalculatorApp api={api} />);

    expect(screen.getByTestId('calc-display')).toHaveTextContent('0');
    expect(screen.getByTestId('calc-expression')).toHaveTextContent('');
    expect(await screen.findByTestId('history-empty')).toBeInTheDocument();
  });

  it('берёт символы операций из backend', async () => {
    const { api, calls } = createFakeApi();
    render(<CalculatorApp api={api} />);

    await waitFor(() => expect(calls.operations).toBeGreaterThan(0));
    expect(key('multiply')).toHaveTextContent('×');
    expect(key('divide')).toHaveTextContent('÷');
  });

  it('использует fallback-символы, если справочник операций недоступен', async () => {
    const { api } = createFakeApi({
      operations: async () => {
        throw new ApiClientError('NETWORK_ERROR', 'Сервер вычислений недоступен. Проверьте, что backend запущен.');
      },
    });
    render(<CalculatorApp api={api} />);

    expect(await screen.findByRole('button', { name: 'Умножение' })).toHaveTextContent('×');
    expect(screen.queryByTestId('app-error')).not.toBeInTheDocument();
  });
});

describe('CalculatorApp: вычисление', () => {
  it('2 + 2 = 4 через backend', async () => {
    const user = userEvent.setup();
    const { api, calls } = createFakeApi();
    render(<CalculatorApp api={api} />);

    await user.click(key('2'));
    await user.click(key('add'));
    await user.click(key('2'));
    await user.click(key('equals'));

    await waitFor(() => expect(calls.calculate).toHaveLength(1));
    expect(calls.calculate[0]).toEqual({ operation: 'add', operands: [2, 2] });
    expect(screen.getByTestId('calc-display')).toHaveTextContent('4');
    expect(screen.getByTestId('calc-expression')).toHaveTextContent('2 + 2');
  });

  it('не отправляет запрос без второго операнда', async () => {
    const user = userEvent.setup();
    const { api, calls } = createFakeApi();
    render(<CalculatorApp api={api} />);

    await user.click(key('5'));
    await user.click(key('add'));
    await user.click(key('equals'));

    expect(calls.calculate).toHaveLength(0);
    expect(screen.getByTestId('calc-expression')).toHaveTextContent('5 +');
  });

  it('показывает индикатор вычисления и блокирует клавиатуру', async () => {
    const user = userEvent.setup();
    let resolveCalculation: (value: CalculationResult) => void = () => undefined;
    const pending = new Promise<CalculationResult>((resolve) => {
      resolveCalculation = resolve;
    });
    const { api } = createFakeApi({ calculate: () => pending });
    render(<CalculatorApp api={api} />);

    await user.click(key('2'));
    await user.click(key('add'));
    await user.click(key('2'));
    await user.click(key('equals'));

    expect(await screen.findByTestId('app-busy')).toBeInTheDocument();
    expect(key('equals')).toBeDisabled();

    resolveCalculation(FIXTURE_ADD_RESULT);
    await waitFor(() => expect(screen.queryByTestId('app-busy')).not.toBeInTheDocument());
    expect(screen.getByTestId('calc-display')).toHaveTextContent('4');
  });

  it('показывает ошибку backend и сохраняет ввод', async () => {
    const user = userEvent.setup();
    const { api, calls } = createFakeApi({
      calculate: async () => {
        throw new ApiClientError('DIVISION_BY_ZERO', FIXTURE_DIVISION_ERROR.error.message, 400);
      },
    });
    render(<CalculatorApp api={api} />);

    await user.click(key('8'));
    await user.click(key('divide'));
    await user.click(key('0'));
    await user.click(key('equals'));

    const error = await screen.findByTestId('app-error');
    expect(error).toHaveTextContent('Деление на ноль недопустимо');
    expect(error).toHaveAttribute('role', 'alert');
    expect(calls.calculate[0]).toEqual({ operation: 'divide', operands: [8, 0] });
    expect(screen.getByTestId('calc-display')).toHaveTextContent('0');
    expect(screen.queryByTestId('app-busy')).not.toBeInTheDocument();
  });

  it('AC сбрасывает ввод и ошибку, но не трогает серверную историю', async () => {
    const user = userEvent.setup();
    const { api, calls } = createFakeApi({
      calculate: async () => {
        throw new ApiClientError('DIVISION_BY_ZERO', FIXTURE_DIVISION_ERROR.error.message, 400);
      },
    });
    render(<CalculatorApp api={api} />);

    await user.click(key('9'));
    await user.click(key('divide'));
    await user.click(key('0'));
    await user.click(key('equals'));
    await screen.findByTestId('app-error');

    await user.click(key('clear'));

    expect(screen.queryByTestId('app-error')).not.toBeInTheDocument();
    expect(screen.getByTestId('calc-display')).toHaveTextContent('0');
    expect(screen.getByTestId('calc-expression')).toHaveTextContent('');
    expect(calls.clearHistory).toBe(0);
  });
});

describe('CalculatorApp: история операций', () => {
  it('показывает записи backend и подставляет результат по клику', async () => {
    const user = userEvent.setup();
    const { api } = createFakeApi({
      history: async () => ({ items: FIXTURE_HISTORY.items, total: FIXTURE_HISTORY.total }),
    });
    render(<CalculatorApp api={api} />);

    const list = await screen.findByTestId('history');
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(FIXTURE_HISTORY.items.length);
    expect(items[0]).toHaveTextContent('1 ÷ 3');
    expect(items[0]).toHaveTextContent('0.333333333333');

    await user.click(within(items[0]).getByRole('button'));
    expect(screen.getByTestId('calc-display')).toHaveTextContent('0.333333333333');
  });

  it('обновляет историю после успешного вычисления', async () => {
    const user = userEvent.setup();
    let callsToHistory = 0;
    const { api } = createFakeApi({
      history: async () => {
        callsToHistory += 1;
        return callsToHistory === 1
          ? { items: [], total: 0 }
          : { items: FIXTURE_HISTORY.items, total: FIXTURE_HISTORY.total };
      },
    });
    render(<CalculatorApp api={api} />);

    await screen.findByTestId('history-empty');
    await user.click(key('2'));
    await user.click(key('add'));
    await user.click(key('2'));
    await user.click(key('equals'));

    const list = await screen.findByTestId('history');
    expect(within(list).getAllByRole('listitem')).toHaveLength(FIXTURE_HISTORY.items.length);
    expect(callsToHistory).toBeGreaterThanOrEqual(2);
  });

  it('очищает историю через DELETE-эндпоинт', async () => {
    const user = userEvent.setup();
    const { api, calls } = createFakeApi({
      history: async () => ({ items: FIXTURE_HISTORY.items, total: FIXTURE_HISTORY.total }),
    });
    render(<CalculatorApp api={api} />);

    await screen.findByTestId('history');
    await user.click(screen.getByTestId('history-clear'));

    await waitFor(() => expect(screen.getByTestId('history-empty')).toBeInTheDocument());
    expect(calls.clearHistory).toBe(1);
    expect(screen.queryByTestId('history')).not.toBeInTheDocument();
  });
});

describe('CalculatorApp: клавиатура', () => {
  it('поддерживает цифры, операции и Enter', async () => {
    const user = userEvent.setup();
    const { api, calls } = createFakeApi({ calculate: async () => result42() });
    render(<CalculatorApp api={api} />);

    await user.keyboard('7*6{Enter}');

    await waitFor(() => expect(calls.calculate).toHaveLength(1));
    expect(calls.calculate[0]).toEqual({ operation: 'multiply', operands: [7, 6] });
    expect(screen.getByTestId('calc-display')).toHaveTextContent('42');
    expect(screen.getByTestId('calc-expression')).toHaveTextContent('7 × 6');
  });

  it('Escape выполняет AC', async () => {
    const user = userEvent.setup();
    const { api } = createFakeApi();
    render(<CalculatorApp api={api} />);

    await user.keyboard('123');
    expect(screen.getByTestId('calc-display')).toHaveTextContent('123');

    await user.keyboard('{Escape}');
    expect(screen.getByTestId('calc-display')).toHaveTextContent('0');
  });

  it('Backspace удаляет последнюю цифру', async () => {
    const user = userEvent.setup();
    const { api } = createFakeApi();
    render(<CalculatorApp api={api} />);

    await user.keyboard('12{Backspace}');
    expect(screen.getByTestId('calc-display')).toHaveTextContent('1');
  });
});
