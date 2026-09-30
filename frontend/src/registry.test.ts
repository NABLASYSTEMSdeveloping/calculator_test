/**
 * Проверка публикации контракта: версия в реестре контрактов совпадает с CONTRACT.md и package.json.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { REPO_ROOT } from './test/fixtures';

interface RegistryContract {
  service: string;
  mission: string;
  version: string;
  status: string;
  contract_path: string;
  implementation_path: string;
  depends_on: { service: string; contract_version: string; status: string }[];
}

interface Registry {
  schema_version: number;
  updated_at: string;
  contracts: RegistryContract[];
}

function loadRegistry(): Registry {
  return JSON.parse(readFileSync(resolve(REPO_ROOT, 'registry/contracts.json'), 'utf8')) as Registry;
}

function loadPackageVersion(): string {
  const pkg = JSON.parse(readFileSync(resolve(REPO_ROOT, 'frontend/package.json'), 'utf8')) as { version: string };
  return pkg.version;
}

const CONTRACT_VERSION_PATTERN = /^\| version \| `([^`]+)` \|$/m;

function loadContractVersion(): string {
  const markdown = readFileSync(resolve(REPO_ROOT, 'services/calculator-test-app/CONTRACT.md'), 'utf8');
  const match = CONTRACT_VERSION_PATTERN.exec(markdown);
  if (match === null) {
    throw new Error('В CONTRACT.md не найдено поле version');
  }
  return match[1];
}

describe('реестр контрактов', () => {
  it('содержит опубликованную запись сервиса frontend', () => {
    const registry = loadRegistry();
    const entry = registry.contracts.find((contract) => contract.service === 'frontend');
    expect(entry).toBeDefined();
    expect(entry?.mission).toBe('calculator-test-app');
    expect(entry?.status).toBe('published');
  });

  it('версия в реестре совпадает с CONTRACT.md и package.json', () => {
    const registry = loadRegistry();
    const entry = registry.contracts.find((contract) => contract.service === 'frontend');
    const version = entry?.version;
    expect(version).toBeDefined();
    expect(version).toBe(loadContractVersion());
    expect(version).toBe(loadPackageVersion());
  });

  it('указывает путь контракта, реализацию и зависимость от backend', () => {
    const registry = loadRegistry();
    const entry = registry.contracts.find((contract) => contract.service === 'frontend');
    expect(entry?.contract_path).toBe('services/calculator-test-app/CONTRACT.md');
    expect(entry?.implementation_path).toBe('frontend/');
    expect(entry?.depends_on.map((dependency) => dependency.service)).toContain('backend');
  });

  it('все версии — SemVer и время обновления в ISO-8601', () => {
    const registry = loadRegistry();
    expect(registry.schema_version).toBeGreaterThan(0);
    expect(Number.isNaN(Date.parse(registry.updated_at))).toBe(false);
    for (const contract of registry.contracts) {
      expect(contract.version).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });
});
