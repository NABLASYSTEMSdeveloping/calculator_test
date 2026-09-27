import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Доступ к контрактным фикстурам миссии (общий источник правды с сервисом backend).
 * Фикстуры читаются с диска, а не импортируются, чтобы оставаться внешним артефактом контракта.
 */

const here = dirname(fileURLToPath(import.meta.url));
export const FIXTURES_DIR = resolve(here, '../../../services/calculator-test-app/fixtures');
export const REPO_ROOT = resolve(here, '../../..');

export interface ContractFixture {
  $comment?: string;
  request: Record<string, unknown>;
  status: number;
  headers?: Record<string, string>;
  response: unknown;
}

export const FIXTURE_NAMES = [
  'calculate-success',
  'calculate-division-by-zero',
  'calculate-invalid',
  'history',
  'operations',
  'health',
] as const;

export type FixtureName = (typeof FIXTURE_NAMES)[number];

export function loadFixture(name: FixtureName): ContractFixture {
  const path = resolve(FIXTURES_DIR, `${name}.json`);
  return JSON.parse(readFileSync(path, 'utf8')) as ContractFixture;
}

export function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}
