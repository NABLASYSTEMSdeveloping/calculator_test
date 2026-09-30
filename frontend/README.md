# frontend — сервис calculator-test-app

Калькулятор в браузере: React 19 + TypeScript + Vite 7, тесты на Vitest 3 (jsdom).

```bash
npm install            # из корня монорепозитория (npm workspaces)
npm run dev            # http://localhost:5173
npm run test           # тесты
npm run typecheck      # проверка типов
npm run build          # сборка в dist/
```

Контракт сервиса (публичные интерфейсы, семантика, DOM-хуки, команды) —
[`../docs/contracts/frontend.md`](../docs/contracts/frontend.md).

Структура:

| Путь | Назначение |
| --- | --- |
| `src/domain/calculator.ts` | доменное ядро: состояние, действия, чистый редьюсер, форматирование |
| `src/domain/keyboard.ts` | адаптер `KeyboardEvent.key` → действие калькулятора |
| `src/components/Calculator.tsx` | виджет: props `initialState`, `onChange`, `enableKeyboard`, `className` |
| `src/components/Display.tsx`, `src/components/Keypad.tsx` | дисплей и раскладка клавиш |
| `src/App.tsx`, `src/main.tsx`, `src/index.css` | страница, точка входа, стили |
| `src/**/*.test.ts(x)` | доменные, адаптерные, компонентные и smoke-тесты |
| `src/test/setup.ts` | настройка jsdom + Testing Library |
