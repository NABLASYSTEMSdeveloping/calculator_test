import { describe, expect, it, vi } from 'vitest';

import { ApiClientError, CLIENT_MESSAGES, createApiClient, toUserMessage } from './client';
import type { CalculationRequest } from './types';

interface FakeResponseInit {
  status?: number;
  body?: string;
  headers?: Record<string, string>;
}

/** Минимальная реализация Response: тесты не зависят от окружения (jsdom/undici). */
function fakeResponse({ status = 200, body = '', headers = {} }: FakeResponseInit = {}): Response {
  const normalized = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => normalized[name.toLowerCase()] ?? null },
    text: async () => body,
  } as unknown as Response;
}

function jsonFetcher(response: FakeResponseInit) {
  return vi.fn(async () => fakeResponse(response));
}

const SUCCESS = {
  operation: 'add',
  operands: [2, 2],
  result: 4,
  result_text: '4',
  expression: '2 + 2',
  precision: 12,
};

const ADD_REQUEST: CalculationRequest = { operation: 'add', operands: [2, 2] };

describe('createApiClient: базовые настройки', () => {
  it('нормализует baseUrl и обращается по контрактному пути', async () => {
    const fetchImpl = jsonFetcher({ body: JSON.stringify(SUCCESS), headers: { 'x-api-version': '1' } });
    const api = createApiClient({ baseUrl: 'http://backend.test/', fetchImpl, onWarning: vi.fn() });

    expect(api.baseUrl).toBe('http://backend.test');
    await api.calculate(ADD_REQUEST);

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://backend.test/api/v1/calculate');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual(ADD_REQUEST);
  });

  it('передаёт limit в запрос истории', async () => {
    const fetchImpl = jsonFetcher({ body: JSON.stringify({ items: [], total: 0 }) });
    const api = createApiClient({ baseUrl: 'http://backend.test', fetchImpl });

    await api.history(5);

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://backend.test/api/v1/history?limit=5');
    expect(init.method).toBe('GET');
  });

  it('предупреждает о несовпадении мажорной версии API', async () => {
    const onWarning = vi.fn();
    const fetchImpl = jsonFetcher({ body: JSON.stringify(SUCCESS), headers: { 'x-api-version': '2' } });
    const api = createApiClient({ baseUrl: 'http://backend.test', fetchImpl, onWarning });

    await api.calculate(ADD_REQUEST);

    expect(onWarning).toHaveBeenCalledTimes(1);
    expect(onWarning.mock.calls[0][0]).toContain('Версия API backend (2)');
  });
});

describe('createApiClient: успешные ответы', () => {
  it('возвращает результат вычисления', async () => {
    const api = createApiClient({
      baseUrl: 'http://backend.test',
      fetchImpl: jsonFetcher({ body: JSON.stringify(SUCCESS) }),
    });
    await expect(api.calculate(ADD_REQUEST)).resolves.toEqual(SUCCESS);
  });

  it('возвращает список операций', async () => {
    const operations = [{ id: 'add', symbol: '+', label: 'Сложение', arity: 2 }];
    const api = createApiClient({
      baseUrl: 'http://backend.test',
      fetchImpl: jsonFetcher({ body: JSON.stringify({ items: operations }) }),
    });
    await expect(api.operations()).resolves.toEqual(operations);
  });

  it('принимает 204 при очистке истории', async () => {
    const fetchImpl = vi.fn(async () => fakeResponse({ status: 204 }));
    const api = createApiClient({ baseUrl: 'http://backend.test', fetchImpl });
    await expect(api.clearHistory()).resolves.toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('createApiClient: ошибки', () => {
  it('пробрасывает конверт ошибки backend', async () => {
    const api = createApiClient({
      baseUrl: 'http://backend.test',
      fetchImpl: jsonFetcher({
        status: 400,
        body: JSON.stringify({ error: { code: 'DIVISION_BY_ZERO', message: 'Деление на ноль недопустимо' } }),
      }),
    });

    await expect(api.calculate({ operation: 'divide', operands: [8, 0] })).rejects.toMatchObject({
      code: 'DIVISION_BY_ZERO',
      message: 'Деление на ноль недопустимо',
      status: 400,
    });
  });

  it('возвращает NETWORK_ERROR, если fetch упал', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('network down');
    });
    const api = createApiClient({ baseUrl: 'http://backend.test', fetchImpl });

    await expect(api.calculate(ADD_REQUEST)).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      message: CLIENT_MESSAGES.NETWORK_ERROR,
    });
  });

  it('возвращает MALFORMED_RESPONSE на не-JSON тело успешного ответа', async () => {
    const api = createApiClient({
      baseUrl: 'http://backend.test',
      fetchImpl: jsonFetcher({ body: '<html>oops</html>' }),
    });

    await expect(api.calculate(ADD_REQUEST)).rejects.toMatchObject({ code: 'MALFORMED_RESPONSE' });
  });

  it('возвращает MALFORMED_RESPONSE на JSON с нарушенной схемой', async () => {
    const api = createApiClient({
      baseUrl: 'http://backend.test',
      fetchImpl: jsonFetcher({ body: JSON.stringify({ ...SUCCESS, result: '4' }) }),
    });

    await expect(api.calculate(ADD_REQUEST)).rejects.toMatchObject({ code: 'MALFORMED_RESPONSE' });
  });

  it('возвращает HTTP_<status>, если тело ошибки не по контракту', async () => {
    const api = createApiClient({
      baseUrl: 'http://backend.test',
      fetchImpl: jsonFetcher({ status: 500, body: 'Internal Server Error' }),
    });

    await expect(api.calculate(ADD_REQUEST)).rejects.toMatchObject({ code: 'HTTP_500', status: 500 });
  });

  it('возвращает HTTP_<status> при ошибке очистки истории', async () => {
    const fetchImpl = vi.fn(async () => fakeResponse({ status: 503 }));
    const api = createApiClient({ baseUrl: 'http://backend.test', fetchImpl });

    await expect(api.clearHistory()).rejects.toMatchObject({ code: 'HTTP_503', status: 503 });
  });

  it('пробрасывает конверт ошибки backend при ошибке очистки истории (CONTRACT.md §6)', async () => {
    const api = createApiClient({
      baseUrl: 'http://backend.test',
      fetchImpl: jsonFetcher({
        status: 500,
        body: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Внутренняя ошибка сервера' } }),
      }),
    });

    await expect(api.clearHistory()).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      message: 'Внутренняя ошибка сервера',
      status: 500,
    });
  });
});

describe('toUserMessage', () => {
  it('отдаёт сообщение конверта ошибки как есть', () => {
    expect(toUserMessage(new ApiClientError('DIVISION_BY_ZERO', 'Деление на ноль недопустимо', 400))).toBe(
      'Деление на ноль недопустимо',
    );
  });

  it('для неизвестной ошибки возвращает сообщение о недоступности сервера', () => {
    expect(toUserMessage('неизвестно')).toBe(CLIENT_MESSAGES.NETWORK_ERROR);
  });
});
