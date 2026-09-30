import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { CalculatorApp } from './components/CalculatorApp';
import './styles.css';

const container = document.getElementById('root');
import { App } from './App';
import './index.css';

const container = document.getElementById('root');

if (container === null) {
  throw new Error('Не найден корневой элемент #root');
}

createRoot(container).render(
  <StrictMode>
    <CalculatorApp />
    <App />
  </StrictMode>,
);
