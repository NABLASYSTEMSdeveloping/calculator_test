/**
 * Проверки типов ответов backend. Используются и клиентом, и контрактными тестами (фикстуры миссии).
 */

import type {
  ApiErrorBody,
  CalculationResult,
  HealthResponse,
  HistoryEntry,
  HistoryResponse,
  OperationId,
  OperationInfo,
  OperationsResponse,
} from './types';

export const OPERATION_IDS: readonly OperationId[] = ['add', 'subtract', 'multiply', 'divide'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOperationId(value: unknown): value is OperationId {
  return typeof value === 'string' && (OPERATION_IDS as readonly string[]).includes(value);
}

function isOperands(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((item) => typeof item === 'number' && Number.isFinite(item))
  );
}

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (!isRecord(value) || !isRecord(value.error)) {
    return false;
  }
  return typeof value.error.code === 'string' && typeof value.error.message === 'string';
}

export function isCalculationResult(value: unknown): value is CalculationResult {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isOperationId(value.operation) &&
    isOperands(value.operands) &&
    typeof value.result === 'number' &&
    Number.isFinite(value.result) &&
    typeof value.result_text === 'string' &&
    typeof value.expression === 'string' &&
    typeof value.precision === 'number'
  );
}

export function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (!isCalculationResult(value)) {
    return false;
  }
  const entry = value as unknown as Record<string, unknown>;
  return typeof entry.id === 'string' && entry.id.length > 0 && typeof entry.created_at === 'string';
}

export function isHistoryResponse(value: unknown): value is HistoryResponse {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    return false;
  }
  return value.items.every(isHistoryEntry) && typeof value.total === 'number';
}

export function isOperationInfo(value: unknown): value is OperationInfo {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isOperationId(value.id) &&
    typeof value.symbol === 'string' &&
    typeof value.label === 'string' &&
    value.arity === 2
  );
}

export function isOperationsResponse(value: unknown): value is OperationsResponse {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    return false;
  }
  return value.items.every(isOperationInfo);
}

export function isHealthResponse(value: unknown): value is HealthResponse {
  if (!isRecord(value)) {
    return false;
  }
  return (
    value.status === 'ok' &&
    typeof value.service === 'string' &&
    typeof value.version === 'string' &&
    typeof value.api_version === 'number'
  );
}
