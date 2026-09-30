import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('рендерит заголовок, калькулятор и подсказку по клавиатуре', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Калькулятор');
    expect(screen.getByTestId('calculator')).toBeInTheDocument();
    expect(screen.getByTestId('keypad')).toBeInTheDocument();
    expect(screen.getByTestId('keyboard-hint')).toHaveTextContent('Enter');
  });

  it('считает изменения состояния, приходящие из onChange', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByTestId('change-count')).toHaveTextContent('Изменений состояния: 1');

    await user.click(screen.getByTestId('key-1'));

    expect(screen.getByTestId('display-value')).toHaveTextContent('1');
    expect(screen.getByTestId('change-count')).toHaveTextContent('Изменений состояния: 2');
  });
});
