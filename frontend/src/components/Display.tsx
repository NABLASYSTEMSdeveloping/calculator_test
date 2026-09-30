export interface DisplayProps {
  entry: string;
  expression: string;
}

/** Дисплей: выражение и текущее значение. `role="status"` — контракт доступности. */
export function Display({ entry, expression }: DisplayProps) {
  return (
    <div className="display">
      <div className="display__expression" data-testid="calc-expression">
        {expression}
      </div>
      <output className="display__value" data-testid="calc-display" role="status" aria-live="polite">
        {entry}
      </output>
    </div>
  );
}
