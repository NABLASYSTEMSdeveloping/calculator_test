import type { HistoryEntry } from '../api/types';

export interface HistoryPanelProps {
  items: HistoryEntry[];
  disabled?: boolean;
  onSelect: (item: HistoryEntry) => void;
  onClear: () => void;
}

/** Панель истории: список серверных записей, новые первыми. */
export function HistoryPanel({ items, disabled = false, onSelect, onClear }: HistoryPanelProps) {
  return (
    <section className="history" aria-label="История операций">
      <header className="history__header">
        <h2 className="history__title">История</h2>
        <button
          type="button"
          data-testid="history-clear"
          className="history__clear"
          onClick={onClear}
          disabled={disabled || items.length === 0}
        >
          Очистить
        </button>
      </header>

      {items.length === 0 ? (
        <p className="history__empty" data-testid="history-empty">
          Пока нет операций
        </p>
      ) : (
        <ul className="history__list" data-testid="history" role="list">
          {items.map((item) => (
            <li className="history__list-item" key={item.id}>
              <button type="button" className="history__item" onClick={() => onSelect(item)}>
                <span className="history__expression">{item.expression}</span>
                <span className="history__result">= {item.result_text}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
