/**
 * DTO сервиса backend (см. services/calculator-test-app/CONTRACT.md, раздел 4.1).
 * Дублируются ровно те поля, которые фронт использует по контракту.
 */

export type OperationId = 'add' | 'subtract' | 'multiply' | 'divide';

export interface OperationInfo {
  id: OperationId;
  symbol: string;
  label: string;
  arity: 2;
}

export interface CalculationRequest {
  operation: OperationId;
  operands: [number, number];
  precision?: number;
}

export interface CalculationResult {
  operation: OperationId;
  operands: [number, number];
  result: number;
  result_text: string;
  expression: string;
  precision: number;
}

export interface HistoryEntry extends CalculationResult {
  id: string;
  created_at: string;
}

export interface HistoryResponse {
  items: HistoryEntry[];
  total: number;
}

export interface OperationsResponse {
  items: OperationInfo[];
}

export interface HealthResponse {
  status: 'ok';
  service: string;
  version: string;
  api_version: number;
}

export type ApiErrorCode =
  | 'INVALID_REQUEST'
  | 'UNKNOWN_OPERATION' // зарезервирован контрактом backend, клиент обрабатывает его как любой конверт ошибки
  | 'DIVISION_BY_ZERO'
  | 'PRECISION_OUT_OF_RANGE' // зарезервирован контрактом backend
  | 'INTERNAL_ERROR';

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
  };
}

/** Локальные коды ошибок клиента (см. CONTRACT.md, раздел 6). */
export type ClientErrorCode = 'NETWORK_ERROR' | 'MALFORMED_RESPONSE' | `HTTP_${number}`;

export const API_MAJOR_VERSION = 1;
export const DEFAULT_PRECISION = 12;
