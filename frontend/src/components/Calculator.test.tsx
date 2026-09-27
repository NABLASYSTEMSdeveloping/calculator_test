import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { INITIAL_STATE } from '../domain/calculator';
import { Calculator } from './Calculator';
import { CALCULATOR_KEYS } from './Keypad';

type User = ReturnType<typeof userEvent.setup>;

function displayText(): string {
  return screen.getByTestId('display-value').textContent ?? '';
}

function expressionText(): string {
  return (screen.getByTestId('expression').textContent ?? '').trim();
}

/** Нажимает клавиши по их стабильным id из раскладки. */
async function clickKeys(user: User, ids: readonly string[]): Promise<void> {
  for (const id of ids) {
    await user.click(screen.getByTestId(`key-${id}`));
  }
}

describe('Calculator', () => {
  it('показывает начальное состояние', () => {
    render(<Calculator />);

    expect(displayText()).toBe(INITIAL_STATE.display);
    expect(expressionText()).toBe('');
    expect(screen.getByTestId('calculator')).toHaveAttribute('aria-label', 'Калькулятор');
    expect(screen.getByTestId('display-value')).toHaveAttribute('data-state', 'ok');
  });

  it('выводит все клавиши раскладки контракта', () => {
    render(<Calculator />);

    expect(CALCULATOR_KEYS).toHaveLength(20);
    for (const key of CALCULATOR_KEYS) {
      const button = screen.getByTestId(`key-${key.id}`);
      expect(button).toHaveAttribute('aria-label', key.ariaLabel);
      expect(button).toHaveAttribute('data-action', key.action.type);
      expect(button).toHaveAttribute('type', 'button');
    }
  });

  it('считает результат по нажатиям клавиш', async () => {
    const user = userEvent.setup();
    render(<Calculator />);

    await clickKeys(user, ['1', '2', 'add', '3', 'equals']);

    expect(displayText()).toBe('15');
    expect(expressionText()).toBe('');
  });

  it('показывает незавершённое выражение', async () => {
    const user = userEvent.setup();
    render(<Calculator />);

    await clickKeys(user, ['7', 'multiply']);

    expect(displayText()).toBe('7');
    expect(expressionText()).toBe('7 ×');
  });

  it('переходит в состояние ошибки при делении на ноль', async () => {
    const user = userEvent.setup();
    render(<Calculator />);

    await clickKeys(user, ['5', 'divide', '0', 'equals']);

    expect(displayText()).toBe('Error');
    expect(screen.getByTestId('display-value')).toHaveAttribute('data-state', 'error');
    expect(screen.getByTestId('calculator')).toHaveClass('calculator--error');
  });

  it('сбрасывается клавишей «C» после ошибки', async () => {
    const user = userEvent.setup();
    render(<Calculator />);

    await clickKeys(user, ['5', 'divide', '0', 'equals', 'clear']);

    expect(displayText()).toBe('0');
    expect(screen.getByTestId('calculator')).not.toHaveClass('calculator--error');
  });

  it('поддерживает ввод с клавиатуры', async () => {
    const user = userEvent.setup();
    render(<Calculator />);

    await user.keyboard('12+3{Enter}');

    expect(displayText()).toBe('15');
  });

  it('поддерживает Backspace и Escape с клавиатуры', async () => {
    const user = userEvent.setup();
    render(<Calculator />);

    await user.keyboard('123{Backspace}');
    expect(displayText()).toBe('12');

    await user.keyboard('{Escape}');
    expect(displayText()).toBe('0');
  });

  it('не перехватывает клавиатуру при enableKeyboard={false}', async () => {
    const user = userEvent.setup();
    render(<Calculator enableKeyboard={false} />);

    await user.keyboard('5');

    expect(displayText()).toBe('0');
  });

  it('не перехватывает клавиши, нажатые в поле ввода', async () => {
    const user = userEvent.setup();
    render(
      <>
        <input aria-label="Тестовое поле" />
        <Calculator />
      </>,
    );

    const field = screen.getByLabelText('Тестовое поле');
    await user.click(field);
    await user.type(field, '42');

    expect(field).toHaveValue('42');
    expect(displayText()).toBe('0');
  });

  it('уведомляет об изменениях состояния через onChange', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<Calculator onChange={handleChange} />);

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange).toHaveBeenLastCalledWith(INITIAL_STATE);

    await clickKeys(user, ['1']);

    const calls = handleChange.mock.calls;
    expect(calls[calls.length - 1]?.[0].display).toBe('1');
  });

  it('принимает начальное состояние через initialState', () => {
    render(<Calculator initialState={{ ...INITIAL_STATE, display: '42', accumulator: 42 }} />);

    expect(displayText()).toBe('42');
  });
});
