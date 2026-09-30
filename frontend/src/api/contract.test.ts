/**
 * Контрактные тесты сервиса frontend: фикстуры миссии (services/calculator-test-app/fixtures)
 * прогоняются через настоящий HTTP-клиент. Падение теста = ломающее изменение контракта backend.
 */

import { describe, expect, it, vi } from 'vitest';

import { FIXTURE_NAMES, loadFixture, type FixtureName } from '../test/fixtures';
import { createApiClient } from './client';
import {
  isApiErrorBody,
  isCalculationResult,
  isHealthResponse,
  isHistoryEntry,
  isHistoryResponse,
  isOperationInfo,
  isOperationsResponse,
} from './guards';
import type { CalculationRequest, OperationId } from './types';

function responseFromFixture(name: FixtureName): Response {
  const fixture = loadFixture(name);
  const headers = Object.fromEntries(
    Object.entries(fixture.headers ?? {}).map(([key, value]) => [key.toLowerCase(), String(value)]),
  );
  return {
    ok: fixture.status >= 200 && fixture.status < 300,
    status: fixture.status,
    headers: { get: (header: string) => headers[header.toLowerCase()] ?? null },
    text: async () => JSON.stringify(fixture.response),
  } as unknown as Response;
}

function clientFor(name: FixtureName) {
  const fetchImpl = vi.fn(async () => responseFromFixture(name));
  return createApiClient({ baseUrl: 'http://backend.test', fetchImpl, onWarning: vi.fn() });
}

describe('набор фикстур', () => {
  it('все фикстуры контракта на месте и структурированы', () => {
    for (const name of FIXTURE_NAMES) {
      const fixture = loadFixture(name);
      expect(fixture.status, name).toBeGreaterThanOrEqual(200);
      expect(fixture.response, name).toBeDefined();
      expect(fixture.headers?.['content-type'], name).toContain('application/json');
    }
  });

  it('успешные фикстуры несут версию API', () => {
    for (const name of FIXTURE_NAMES) {
      const fixture = loadFixture(name);
      if (fixture.status < 200 || fixture.status >= 300) {
        continue;
      }
      expect(fixture.headers?.['x-api-version'], name).toBe('1');
    }
  });
});

describe('calculate-success.json', () => {
  it('соответствует типу CalculationResult', () => {
    const fixture = loadFixture('calculate-success');
    expect(isCalculationResult(fixture.response)).toBe(true);
  });

  it('проходит через HTTP-клиент без изменений', async () => {
    const fixture = loadFixture('calculate-success');
    const result = await clientFor('calculate-success').calculate(fixture.request as unknown as CalculationRequest);
    expect(result).toEqual(fixture.response);
  });

  it('expression и result_text согласованы с операндами', () => {
    const fixture = loadFixture('calculate-success');
    const response = fixture.response as { operands: [number, number]; expression: string; result_text: string };
    expect(response.expression).toBe(`${response.operands[0]} + ${response.operands[1]}`);
    expect(response.result_text).toBe('4');
  });
});

describe('calculate-division-by-zero.json', () => {
  it('соответствует типу ApiErrorBody', () => {
    const fixture = loadFixture('calculate-division-by-zero');
    expect(isApiErrorBody(fixture.response)).toBe(true);
  });

  it('превращается в ApiClientError с сообщением backend', async () => {
    const fixture = loadFixture('calculate-division-by-zero');
    const expected = (fixture.response as { error: { code: string; message: string } }).error;

    await expect(
      clientFor('calculate-division-by-zero').calculate(fixture.request as unknown as CalculationRequest),
    ).rejects.toMatchObject({ code: expected.code, message: expected.message, status: fixture.status });
  });
});

describe('calculate-invalid.json', () => {
  it('соответствует типу ApiErrorBody с кодом INVALID_REQUEST', async () => {
    const fixture = loadFixture('calculate-invalid');
    expect(isApiErrorBody(fixture.response)).toBe(true);

    await expect(
      clientFor('calculate-invalid').calculate(fixture.request as unknown as CalculationRequest),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST', status: 422 });
  });
});

describe('history.json', () => {
  it('соответствует типу HistoryResponse', () => {
    const fixture = loadFixture('history');
    expect(isHistoryResponse(fixture.response)).toBe(true);
  });

  it('записи идут от новых к старым и содержат обязательные поля', () => {
    const fixture = loadFixture('history');
    const response = fixture.response as { items: { created_at: string }[]; total: number };
    expect(response.items).toHaveLength(response.total);

    const timestamps = response.items.map((item) => Date.parse(item.created_at));
    for (const timestamp of timestamps) {
      expect(Number.isNaN(timestamp)).toBe(false);
    }
    expect(timestamps).toEqual([...timestamps].sort((left, right) => right - left));

    for (const item of response.items) {
      expect(isHistoryEntry(item)).toBe(true);
    }
  });

  it('проходит через HTTP-клиент без изменений', async () => {
    const fixture = loadFixture('history');
    const history = await clientFor('history').history(20);
    expect(history).toEqual(fixture.response);
  });
});

describe('operations.json', () => {
  it('описывает ровно четыре контрактные операции', () => {
    const fixture = loadFixture('operations');
    expect(isOperationsResponse(fixture.response)).toBe(true);

    const items = (fixture.response as { items: { id: OperationId }[] }).items;
    expect(items.map((item) => item.id)).toEqual(['add', 'subtract', 'multiply', 'divide']);
    for (const item of items) {
      expect(isOperationInfo(item)).toBe(true);
    }
  });

  it('проходит через HTTP-клиент без изменений', async () => {
    const fixture = loadFixture('operations');
    const operations = await clientFor('operations').operations();
    expect(operations).toEqual((fixture.response as { items: unknown[] }).items);
  });
});

describe('health.json', () => {
  it('соответствует типу HealthResponse и api_version = 1', async () => {
    const fixture = loadFixture('health');
    expect(isHealthResponse(fixture.response)).toBe(true);
    await expect(clientFor('health').health()).resolves.toEqual(fixture.response);
  });
});
