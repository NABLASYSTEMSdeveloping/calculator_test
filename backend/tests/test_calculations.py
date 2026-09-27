"""Юнит-тесты арифметики: Decimal-точность, форматирование, ошибки."""

from __future__ import annotations

from decimal import Decimal

import pytest

from app.calculations import DEFAULT_PRECISION, OPERATIONS, calculate, format_decimal, to_decimal
from app.errors import ApiError


def test_all_contract_operations_registered() -> None:
    assert set(OPERATIONS) == {"add", "subtract", "multiply", "divide"}
    assert OPERATIONS["add"].symbol == "+"
    assert OPERATIONS["divide"].symbol == "÷"
    assert OPERATIONS["multiply"].as_dict()["arity"] == 2


@pytest.mark.parametrize(
    ("operation", "operands", "expected_text"),
    [
        ("add", (2, 2), "4"),
        ("subtract", (2, 5), "-3"),
        ("multiply", (6, 7), "42"),
        ("divide", (1, 4), "0.25"),
        ("add", (0.1, 0.2), "0.3"),
        ("divide", (1, 3), "0.333333333333"),
        ("multiply", (1000000, 1000000), "1000000000000"),
    ],
)
def test_calculate_returns_canonical_text(operation: str, operands: tuple, expected_text: str) -> None:
    result = calculate(operation, operands)
    assert result["result_text"] == expected_text
    assert result["precision"] == DEFAULT_PRECISION
    assert result["operation"] == operation
    assert result["operands"] == list(operands)


def test_expression_uses_operation_symbol() -> None:
    assert calculate("multiply", (6, 7))["expression"] == "6 × 7"
    assert calculate("divide", (1, 3))["expression"] == "1 ÷ 3"


def test_precision_is_respected() -> None:
    assert calculate("divide", (1, 3), precision=4)["result_text"] == "0.3333"
    assert calculate("divide", (2, 3), precision=28)["result_text"] == "0.6666666666666666666666666667"


def test_division_by_zero_raises_contract_error() -> None:
    with pytest.raises(ApiError) as exc_info:
        calculate("divide", (8, 0))
    assert exc_info.value.code == "DIVISION_BY_ZERO"
    assert exc_info.value.status_code == 400
    assert exc_info.value.message == "Деление на ноль недопустимо"


def test_unknown_operation_raises_invalid_request() -> None:
    with pytest.raises(ApiError) as exc_info:
        calculate("pow", (2, 3))
    assert exc_info.value.code == "INVALID_REQUEST"
    assert exc_info.value.status_code == 422


def test_precision_out_of_range_raises_invalid_request() -> None:
    with pytest.raises(ApiError) as exc_info:
        calculate("add", (1, 1), precision=0)
    assert exc_info.value.code == "INVALID_REQUEST"


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (Decimal("0"), "0"),
        (Decimal("-0"), "0"),
        (Decimal("4.0"), "4"),
        (Decimal("0.3000"), "0.3"),
        (Decimal("1E+2"), "100"),
        (Decimal("-3.50"), "-3.5"),
    ],
)
def test_format_decimal_is_canonical(value: Decimal, expected: str) -> None:
    assert format_decimal(value) == expected


def test_to_decimal_avoids_binary_float_noise() -> None:
    assert to_decimal(0.1) + to_decimal(0.2) == Decimal("0.3")
    with pytest.raises(ValueError):
        to_decimal(True)
    with pytest.raises(ValueError):
        to_decimal(float("nan"))
