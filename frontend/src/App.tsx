import { useCallback, useState } from 'react';
import type { ReactElement } from 'react';
import { Calculator } from './components/Calculator';

/**
 * Корневой компонент сервиса frontend.
 * Демонстрирует использование события `onChange` виджета калькулятора.
 */
export function App(): ReactElement {
  const [changeCount, setChangeCount] = useState(0);

  const handleChange = useCallback(() => {
    setChangeCount((count) => count + 1);
  }, []);

  return (
    <main className="app">
      <header className="app__header">
        <h1 className="app__title">Калькулятор</h1>
        <p className="app__subtitle">calculator-test-app — сервис frontend</p>
      </header>

      <Calculator onChange={handleChange} />

      <p className="app__hint" data-testid="keyboard-hint">
        Клавиатура: 0-9, «.», «+», «-», «*», «/», Enter — «=», Backspace, Esc — «C», Del — «CE»,
        «%», F9 — «±»
      </p>
      <p className="app__meta" data-testid="change-count">
        Изменений состояния: {changeCount}
      </p>
    </main>
  );
}
