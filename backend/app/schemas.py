"""Pydantic-схемы запросов/ответов — контракт DTO с сервисом frontend."""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, Field, field_validator

from .calculations import DEFAULT_PRECISION, MAX_PRECISION, MIN_PRECISION, OPERATION_IDS

OperationId = Literal["add", "subtract", "multiply", "divide"]
Operand = Annotated[float | int, Field(description="Числовой операнд (int или float)")]


class CalculationRequest(BaseModel):
    """Тело POST /api/v1/calculate."""

    operation: str
    operands: tuple[Operand, Operand]
    precision: int = DEFAULT_PRECISION

    @field_validator("operation")
    @classmethod
    def _known_operation(cls, value: str) -> str:
        if value not in OPERATION_IDS:
            raise ValueError("операция не поддерживается")
        return value

    @field_validator("precision")
    @classmethod
    def _precision_range(cls, value: int) -> int:
        if not MIN_PRECISION <= value <= MAX_PRECISION:
            raise ValueError(f"допустимый диапазон {MIN_PRECISION}..{MAX_PRECISION}")
        return value

    @field_validator("operands", mode="before")
    @classmethod
    def _numeric_finite_operands(cls, value: object) -> object:
        """До коэрции Pydantic проверяет, что операнды — именно числа (не bool/str/null).

        `mode="before"` обязателен: `float | int` в lax-режиме Pydantic приводит `true` к `1`,
        а `"2"` к `2.0`, поэтому пост-валидатор bool уже не видит (CONTRACT.md, раздел 4.1: `[number, number]`).
        """

        if not isinstance(value, (list, tuple)):
            return value
        for operand in value:
            if isinstance(operand, bool) or not isinstance(operand, (int, float)):
                raise ValueError("операнд должен быть числом")
            if operand != operand or operand in (float("inf"), float("-inf")):
                raise ValueError("операнд должен быть конечным числом")
        return value


class CalculationResult(BaseModel):
    """Ответ POST /api/v1/calculate."""

    operation: OperationId
    operands: tuple[Operand, Operand]
    result: float
    result_text: str
    expression: str
    precision: int


class OperationInfo(BaseModel):
    id: OperationId
    symbol: str
    label: str
    arity: Literal[2] = 2


class OperationsResponse(BaseModel):
    items: list[OperationInfo]


class HistoryEntry(CalculationResult):
    id: str
    created_at: str


class HistoryResponse(BaseModel):
    items: list[HistoryEntry]
    total: int


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    service: str = "backend"
    version: str
    api_version: int = 1


class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorDetail
