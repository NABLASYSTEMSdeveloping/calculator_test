# Реестр контрактов

Единственный источник правды об интерфейсах сервисов миссии. **Чужой код не читаем** — знание о
соседях берётся только отсюда.

## Формат записи (`registry/contracts.json`)

```json
{
  "schema_version": 1,
  "updated_at": "<ISO-8601 UTC>",
  "contracts": [
    {
      "service": "frontend",
      "mission": "calculator-test-app",
      "version": "1.0.0",            // SemVer, растёт при публикации новой версии контракта
      "previous_version": null,      // предыдущая опубликованная версия (null — первая публикация)
      "status": "published",
      "contract_path": "services/calculator-test-app/CONTRACT.md",
      "implementation_path": "frontend/",
      "runtime": "react@18.3.1 + vite@5.4.11",
      "depends_on": [ { "service": "backend", "contract_version": "1.0.0", "status": "..." } ]
    }
  ]
}
```

## Правила

1. Сервис не читает чужой код: интерфейсы соседа берутся из его записи в этом реестре.
2. Публикация = новая запись или рост `version` + запись в журнале изменений `CONTRACT.md`.
3. Изменение интерфейса, на который ссылается `depends_on`, без роста MAJOR у зависимости — ломающее
   изменение: работы по сервису-потребителю останавливаются, факт эскалируется владельцу.
4. Запись считается актуальной, если `version` в реестре совпадает с версией в `CONTRACT.md`
   (проверяется тестом `frontend/src/registry.test.ts`).

## Текущее состояние

| Сервис | Миссия | Версия | Статус | Контракт |
| --- | --- | --- | --- | --- |
| `frontend` | `calculator-test-app` | `1.0.0` | published | `services/calculator-test-app/CONTRACT.md` |
| `backend` | `calculator-test-app` | — | required-not-published | ожидается от соседнего сервиса |

У `backend` опубликованной версии контракта нет: в записи `frontend` поле `depends_on[0].contract_version = "1.0.0"`
— это версия **ожидания потребителя** (consumer-driven contract, раздел 5.1 `CONTRACT.md`), а не опубликованный
контракт `backend`. Соответствие ожидания факту проверяется контрактными фикстурами и `scripts/qa_review.sh`.
