"""Ошибки API в едином конверте {error: {code, message}}."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class ApiError(Exception):
    """Ошибка, которая сериализуется в контрактный конверт ошибки."""

    code: str
    message: str
    status_code: int = 400

    def __str__(self) -> str:  # pragma: no cover - отладочное представление
        return f"{self.status_code} {self.code}: {self.message}"


DIVISION_BY_ZERO = ApiError(
    code="DIVISION_BY_ZERO",
    message="Деление на ноль недопустимо",
    status_code=400,
)

INVALID_REQUEST = "INVALID_REQUEST"
INTERNAL_ERROR = "INTERNAL_ERROR"
