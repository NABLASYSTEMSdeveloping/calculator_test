/**
 * Фейковый backend для тестов UI: реализует `CalculatorApi` и записывает вызовы.
 * Позволяет проверить, что фронт отправляет ровно те запросы, что описаны в контракте.
 */

import type { CalculatorApi } from '../api/client';
import type {
  CalculationRequest,
  CalculationResult,
  HealthResponse,
  HistoryEntry,
  HistoryResponse,
  OperationInfo,
} from '../api/types';
import { loadFixture } from './fixtures';

export interface FakeApiCalls {
  calculate: CalculationRequest[];
  history: number;
  clearHistory: number;
  operations: number;
  health: number;
}

export interface FakeApiOptions {
  operations?: () => Promise<OperationInfo[]>;
  calculate?: (request: CalculationRequest) => Promise<CalculationResult>;
  history?: () => Promise<HistoryResponse>;
  clearHistory?: () => Promise<void>;
}

export const FIXTURE_OPERATIONS = (loadFixture('operations').response as { items: OperationInfo[] }).items;
export const FIXTURE_HISTORY = loadFixture('history').response as HistoryResponse;
export const FIXTURE_ADD_RESULT = loadFixture('calculate-success').response as CalculationResult;
export const FIXTURE_DIVISION_ERROR = loadFixture('calculate-division-by-zero').response as {
  error: { code: string; message: string };
};

/** Ответ для 2 + 2 из контрактной фикстуры: любой другой запрос — ошибка теста. */
export async function defaultCalculate(request: CalculationRequest): Promise<CalculationResult> {
  if (request.operation === 'add' && request.operands[0] === 2 && request.operands[1] === 2) {
    return FIXTURE_ADD_RESULT;
  }
  throw new Error(`Неожиданный запрос вычисления: ${JSON.stringify(request)}`);
}

export function createFakeApi(options: FakeApiOptions = {}): { api: CalculatorApi; calls: FakeApiCalls } {
  const calls: FakeApiCalls = { calculate: [], history: 0, clearHistory: 0, operations: 0, health: 0 };
  let historyItems: HistoryEntry[] = [];

  const api: CalculatorApi = {
    baseUrl: 'http://fake-backend.test',

    async health(): Promise<HealthResponse> {
      calls.health += 1;
      return { status: 'ok', service: 'backend', version: '1.0.0', api_version: 1 };
    },

    async operations(): Promise<OperationInfo[]> {
      calls.operations += 1;
      return options.operations ? options.operations() : FIXTURE_OPERATIONS;
    },

    async calculate(request: CalculationRequest): Promise<CalculationResult> {
      calls.calculate.push(request);
      return options.calculate ? options.calculate(request) : defaultCalculate(request);
    },

    async history(): Promise<HistoryResponse> {
      calls.history += 1;
      if (options.history) {
        return options.history();
      }
      return { items: historyItems, total: historyItems.length };
    },

    async clearHistory(): Promise<void> {
      calls.clearHistory += 1;
      if (options.clearHistory) {
        return options.clearHistory();
      }
      historyItems = [];
    },
  };

  return { api, calls };
}
