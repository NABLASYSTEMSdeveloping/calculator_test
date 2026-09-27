/**
 * Интеграционный контрактный тест: настоящий HTTP-клиент фронта против живого сервиса backend.
 * Запускается только при заданном LIVE_BACKEND_URL (`make smoke`), поэтому `npm test` остаётся автономным.
 */

import { describe, expect, it } from 'vitest';

import { loadFixture } from '../test/fixtures';
import { createApiClient } from './client';
import type { CalculationRequest } from './types';

const liveBaseUrl = process.env.LIVE_BACKEND_URL ?? '';
const describeLive = liveBaseUrl === '' ? describe.skip : describe;

describeLive(`живой backend (${liveBaseUrl || 'не задан'})`, () => {
  const client = createApiClient({ baseUrl: liveBaseUrl, onWarning: () => undefined });

  it('служебные маршруты отвечают по контракту', async () => {
    await expect(client.health()).resolves.toMatchObject({ status: 'ok', service: 'backend', api_version: 1 });

    const operations = await client.operations();
    expect(operations.map((operation) => operation.id)).toEqual(['add', 'subtract', 'multiply', 'divide']);
    expect(operations.map((operation) => operation.symbol)).toEqual(['+', '-', '×', '÷']);
  });

  it('вычисление совпадает с контрактной фикстурой', async () => {
    const fixture = loadFixture('calculate-success');
    const result = await client.calculate(fixture.request as unknown as CalculationRequest);
    expect(result).toEqual(fixture.response);
  });

  it('деление на ноль приходит конвертом ошибки', async () => {
    await expect(client.calculate({ operation: 'divide', operands: [8, 0] })).rejects.toMatchObject({
      code: 'DIVISION_BY_ZERO',
      message: 'Деление на ноль недопустимо',
      status: 400,
    });
  });

  it('история ведётся от новых к старым и очищается', async () => {
    await client.clearHistory();
    await client.calculate({ operation: 'add', operands: [2, 2] });
    await client.calculate({ operation: 'multiply', operands: [6, 7] });

    const history = await client.history(10);
    expect(history.total).toBe(2);
    expect(history.items.map((item) => item.result_text)).toEqual(['42', '4']);
    expect(history.items.every((item) => item.id.length > 0 && item.created_at.endsWith('Z'))).toBe(true);

    await client.clearHistory();
    await expect(client.history(10)).resolves.toMatchObject({ items: [], total: 0 });
  });

  it('на счётчике знаков не появляется float-мусора', async () => {
    const result = await client.calculate({ operation: 'add', operands: [0.1, 0.2] });
    expect(result.result_text).toBe('0.3');
  });
});
