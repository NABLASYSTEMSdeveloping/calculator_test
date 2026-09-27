"""Арифметика на Decimal + реестр операций (единственное место, где выполняются вычисления)."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Context, Decimal, DecimalException, localcontext
from typing import Callable

from .errors import DIVISION_BY_ZERO, ApiError

DEFAULT_PRECISION = 12
MIN_PRECISION = 1
MAX_PRECISION = 28


@dataclass(frozen=True)
class OperationSpec:
    """Описание бинарной операции."""

    id: str
    symbol: str
    label: str
    func: Callable[[Decimal, Decimal], Decimal]

    def as_dict(self) -> dict:
        return {"id": self.id, "symbol": self.symbol, "label": self.label, "arity": 2}


def _divide(left: Decimal, right: Decimal) -> Decimal:
    if right == 0:
        raise DIVISION_BY_ZERO
    return left / right


OPERATIONS: dict[str, OperationSpec] = {
    "add": OperationSpec("add", "+", "Сложение", lambda a, b: a + b),
    "subtract": OperationSpec("subtract", "-", "Вычитание", lambda a, b: a - b),
    "multiply": OperationSpec("multiply", "×", "Умножение", lambda a, b: a * b),
    "divide": OperationSpec("divide", "÷", "Деление", _divide),
}

OPERATION_IDS: tuple[str, ...] = tuple(OPERATIONS)


def to_decimal(value: float | int) -> Decimal:
    """Приводит входное число к Decimal через строку (без бинарных погрешностей float)."""

    if isinstance(value, bool):  # bool — не число в контракте
        raise ValueError("операнд должен быть числом")
    if isinstance(value, int):
        return Decimal(value)
    if isinstance(value, float) and (value != value or value in (float("inf"), float("-inf"))):
        raise ValueError("операнд должен быть конечным числом")
    return Decimal(str(value))


def format_decimal(value: Decimal) -> str:
    """Каноничное десятичное представление без экспоненты и лишних нулей (`result_text`)."""

    if value == 0:
        return "0"
    normalized = value.normalize()
    if normalized == normalized.to_integral_value():
        return format(normalized.quantize(Decimal(1)), "f")
    return format(normalized, "f")


def calculate(operation: str, operands: tuple[float | int, float | int], precision: int = DEFAULT_PRECISION) -> dict:
    """Выполняет операцию и возвращает `CalculationResult` по контракту."""

    spec = OPERATIONS.get(operation)
    if spec is None:
        raise ApiError(
            code="INVALID_REQUEST",
            message="Некорректный запрос: operation: операция не поддерживается",
            status_code=422,
        )

    if not MIN_PRECISION <= precision <= MAX_PRECISION:
        raise ApiError(
            code="INVALID_REQUEST",
            message=f"Некорректный запрос: precision: допустимый диапазон {MIN_PRECISION}..{MAX_PRECISION}",
            status_code=422,
        )

    left_raw, right_raw = operands
    try:
        left = to_decimal(left_raw)
        right = to_decimal(right_raw)
    except ValueError as exc:  # pragma: no cover - защищается схемой запроса
        raise ApiError(code="INVALID_REQUEST", message=f"Некорректный запрос: operands: {exc}", status_code=422) from exc

    try:
        with localcontext(Context(prec=precision)):
            result = spec.func(left, right)
    except ApiError:
        raise
    except (DecimalException, ZeroDivisionError) as exc:
        raise ApiError(
            code="INVALID_REQUEST",
            message=f"Некорректный запрос: operands: операция не может быть выполнена ({exc})",
            status_code=422,
        ) from exc

    left_text = format_decimal(left)
    right_text = format_decimal(right)
    return {
        "operation": spec.id,
        "operands": [left_raw, right_raw],
        "result": float(result),
        "result_text": format_decimal(result),
        "expression": f"{left_text} {spec.symbol} {right_text}",
        "precision": precision,
    }
