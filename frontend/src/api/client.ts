/**
 * HTTP-клиент сервиса backend. Единственное место в сервисе frontend, где выполняются сетевые вызовы.
 * Арифметику не выполняет: отправляет запрос и валидирует ответ по контракту.
 */

import {
  isApiErrorBody,
  isCalculationResult,
  isHealthResponse,
  isHistoryResponse,
  isOperationsResponse,
} from './guards';
import {
  API_MAJOR_VERSION,
  type ApiErrorCode,
  type CalculationRequest,
  type CalculationResult,
  type ClientErrorCode,
  type HealthResponse,
  type HistoryResponse,
  type OperationInfo,
} from './types';

export const DEFAULT_BASE_URL = 'http://localhost:8000';
export const DEFAULT_TIMEOUT_MS = 8000;

export class ApiClientError extends Error {
  readonly code: ApiErrorCode | ClientErrorCode;
  readonly status: number | null;

  constructor(code: ApiErrorCode | ClientErrorCode, message: string, status: number | null = null) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
  }
}

export interface ApiClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  onWarning?: (message: string) => void;
}

export interface CalculatorApi {
  baseUrl: string;
  health(): Promise<HealthResponse>;
  operations(): Promise<OperationInfo[]>;
  calculate(request: CalculationRequest): Promise<CalculationResult>;
  history(limit?: number): Promise<HistoryResponse>;
  clearHistory(): Promise<void>;
}

export const CLIENT_MESSAGES = {
  NETWORK_ERROR: 'Сервер вычислений недоступен. Проверьте, что backend запущен.',
  MALFORMED_RESPONSE: 'Сервер вернул некорректный ответ.',
} as const;

function readEnv(name: 'VITE_API_BASE_URL' | 'VITE_API_TIMEOUT_MS'): string | undefined {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env;
  return env?.[name];
}

function resolveBaseUrl(baseUrl?: string): string {
  const configured = baseUrl ?? readEnv('VITE_API_BASE_URL') ?? DEFAULT_BASE_URL;
  return configured.replace(/\/+$/, '');
}

function resolveTimeoutMs(timeoutMs?: number): number {
  if (typeof timeoutMs === 'number' && Number.isFinite(timeoutMs) && timeoutMs > 0) {
    return timeoutMs;
  }
  const configured = Number(readEnv('VITE_API_TIMEOUT_MS') ?? DEFAULT_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TIMEOUT_MS;
}

export function createApiClient(options: ApiClientOptions = {}): CalculatorApi {
  const baseUrl = resolveBaseUrl(options.baseUrl);
  const timeoutMs = resolveTimeoutMs(options.timeoutMs);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const warn = options.onWarning ?? ((message: string) => console.warn(message));

  function checkApiVersion(response: Response): void {
    const header = response.headers.get('x-api-version');
    if (header && Number(header) !== API_MAJOR_VERSION) {
      warn(
        `Версия API backend (${header}) не совпадает с ожидаемой мажорной версией ${API_MAJOR_VERSION}. ` +
          'Проверьте services/calculator-test-app/CONTRACT.md.',
      );
    }
  }

  async function send(path: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetchImpl(`${baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: { Accept: 'application/json', ...(init.headers ?? {}) },
      });
    } catch {
      throw new ApiClientError('NETWORK_ERROR', CLIENT_MESSAGES.NETWORK_ERROR);
    } finally {
      clearTimeout(timer);
    }
  }

  function toHttpError(status: number): ApiClientError {
    return new ApiClientError(`HTTP_${status}`, `Ошибка сервера (HTTP ${status}).`, status);
  }

  /** Читает тело ответа один раз; `malformed` — тело есть, но это не JSON. */
  async function readPayload(response: Response): Promise<{ payload: unknown; malformed: boolean }> {
    const rawBody = await response.text();
    if (rawBody.length === 0) {
      return { payload: null, malformed: false };
    }
    try {
      return { payload: JSON.parse(rawBody) as unknown, malformed: false };
    } catch {
      return { payload: null, malformed: true };
    }
  }

  /**
   * Ошибка неуспешного ответа (CONTRACT.md, раздел 6): приоритет у конверта `ApiErrorBody`
   * (`error.message` backend отдаётся пользователю без изменений), иначе — локальный `HTTP_<status>`.
   */
  function toResponseError(response: Response, payload: unknown): ApiClientError {
    if (isApiErrorBody(payload)) {
      return new ApiClientError(payload.error.code, payload.error.message, response.status);
    }
    return toHttpError(response.status);
  }

  async function request<T>(path: string, init: RequestInit, guard: (value: unknown) => value is T): Promise<T> {
    const response = await send(path, init);
    const { payload, malformed } = await readPayload(response);

    if (!response.ok) {
      throw toResponseError(response, payload);
    }

    checkApiVersion(response);
    if (malformed || !guard(payload)) {
      throw new ApiClientError('MALFORMED_RESPONSE', CLIENT_MESSAGES.MALFORMED_RESPONSE, response.status);
    }
    return payload;
  }

  return {
    baseUrl,

    health() {
      return request('/health', { method: 'GET' }, isHealthResponse);
    },

    async operations() {
      const response = await request('/api/v1/operations', { method: 'GET' }, isOperationsResponse);
      return response.items;
    },

    calculate(payload: CalculationRequest) {
      return request(
        '/api/v1/calculate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
        isCalculationResult,
      );
    },

    history(limit = 20) {
      return request(
        `/api/v1/history?limit=${encodeURIComponent(String(limit))}`,
        { method: 'GET' },
        isHistoryResponse,
      );
    },

    async clearHistory() {
      const response = await send('/api/v1/history', { method: 'DELETE' });
      if (!response.ok) {
        const { payload } = await readPayload(response);
        throw toResponseError(response, payload);
      }
    },
  };
}

/** Текст для пользователя: конверт ошибки backend отображается как есть. */
export function toUserMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return CLIENT_MESSAGES.NETWORK_ERROR;
}
