"""Хранилище истории операций: кольцевой буфер в памяти + опциональная персистентность в файл (том)."""

from __future__ import annotations

import json
from collections import deque
from pathlib import Path
from typing import Any

DEFAULT_HISTORY_LIMIT = 100


class HistoryStore:
    """История операций: новые записи первыми, ограничение по количеству, опционально файл на диске."""

    def __init__(self, limit: int = DEFAULT_HISTORY_LIMIT, file_path: str | Path | None = None) -> None:
        self._limit = max(1, int(limit))
        self._file_path = Path(file_path) if file_path else None
        self._items: deque[dict[str, Any]] = deque(maxlen=self._limit)
        self._load()

    # --- публичный интерфейс -------------------------------------------------
    def add(self, entry: dict[str, Any]) -> dict[str, Any]:
        self._items.appendleft(entry)
        self._flush()
        return entry

    def list(self, limit: int | None = None) -> list[dict[str, Any]]:
        items = list(self._items)
        if limit is not None:
            items = items[: max(0, int(limit))]
        return items

    def total(self) -> int:
        return len(self._items)

    def clear(self) -> None:
        self._items.clear()
        self._flush()

    # --- персистентность ----------------------------------------------------
    def _load(self) -> None:
        if self._file_path is None or not self._file_path.exists():
            return
        try:
            raw = json.loads(self._file_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return
        if isinstance(raw, list):
            for entry in reversed(raw[-self._limit :]):
                if isinstance(entry, dict):
                    self._items.appendleft(entry)

    def _flush(self) -> None:
        if self._file_path is None:
            return
        self._file_path.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = self._file_path.with_suffix(self._file_path.suffix + ".tmp")
        tmp_path.write_text(
            json.dumps(list(self._items), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        tmp_path.replace(self._file_path)
