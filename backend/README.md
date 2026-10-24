# Бэкенд

Фазы 1–2: реализованы БД, синтетические данные, бизнес-логика, API и конвейер.
При старте создаются таблицы и добавляется seed; Swagger доступен на `/api/docs`.
Маршруты бизнес-сценария работают; Docker и банковская роль — следующие фазы.

Стек: Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2.x,
SQLite с переключением через DATABASE_URL, pytest, httpx, ruff.

## Локальная проверка

Нужен Python 3.12. Выполняйте команды из `backend/`.
Создайте окружение: `python -m venv .venv`.
На Windows вместо `python` можно использовать `py -3.12`.

Windows PowerShell:

```powershell
.\.venv\Scripts\python.exe -m pip install --require-hashes -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\ruff.exe check .
.\.venv\Scripts\ruff.exe format --check .
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-access-log
```

macOS / Linux:

```sh
.venv/bin/python -m pip install --require-hashes -r requirements-dev.txt
.venv/bin/python -m pytest -q
.venv/bin/ruff check .
.venv/bin/ruff format --check .
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-access-log
```

В текущей рабочей копии uv и Python установлены в игнорируемую `.tools/`.
Созданная через uv `.venv` не содержит pip; для неё из корня репозитория:
`.\.tools\uv\uv.exe pip sync backend/requirements-dev.txt --python backend/.venv/Scripts/python.exe --require-hashes`.
Для запуска без инструментов тестирования используйте `requirements.txt`.
Все прямые и транзитивные зависимости в обоих файлах имеют точные версии и хеши.
`requirements.in` и `requirements-dev.in` — исходники для обновления фиксации через uv pip compile.

## Настройки

Настройки читаются из env и `.env` в текущем каталоге. Копировать `.env` необязательно.

| Переменная | По умолчанию | Назначение |
|---|---|---|
| DATABASE_URL | sqlite:///./data/credit.db | Локальный файл БД |
| BANK_API_TOKEN | demo-bank-token | Демо-токен банковской роли (Фаза 4) |
| PIPELINE_STEP_SECONDS | 1 | Пауза этапа, 0 в тестах |
| SIMULATE_BKI_FAILURE | false | Сбой БКИ и статус NEEDS_RECHECK |
| EGRUL_PROVIDER | simulator | Адаптер ЕГРЮЛ |
| BKI_PROVIDER | simulator | Адаптер БКИ |
| CORS_ORIGINS | localhost:5173 и localhost:8080 | JSON-массив разрешённых origin |
| LOG_LEVEL | INFO | DEBUG, INFO, WARNING, ERROR или CRITICAL |

В корневом `.env.example` путь DATABASE_URL предназначен для контейнера `/data`.
Для локального запуска оставьте значение по умолчанию из таблицы.
Драйвер PostgreSQL не входит в SQLite-сборку; при переходе потребуются драйвер,
новый DATABASE_URL и миграции, бизнес-логику менять не требуется.

## Архитектура и ограничения

`app/domain/` содержит обычные функции и dataclass без FastAPI, Pydantic и БД.
`app/db/` отвечает за SQLAlchemy и seed; `app/core/` — за настройки.
Платёж и переплата округляются half-up независимо от неокруглённого платежа.
Решение сравнивает неокруглённую максимальную сумму с запрошенной;
встречное предложение округляется вниз до 100 000 рублей.

Для MVP используется `create_all`: изменение схемы существующей БД потребует
миграций (например, Alembic) до промышленного запуска.
ЕГРЮЛ, БКИ, подписание кодом 1234 и выдача — локальные симуляторы.
Все данные синтетические; ИНН могут случайно совпасть с реальными.
Все три исхода проверены через API. Docker и интерфейс — следующая фаза.

## Сквозная проверка API

Откройте http://localhost:8000/api/docs — Swagger работает с локальными JS/CSS.
Вызовите GET /api/demo-profiles и выберите профиль. POST /api/applications:

```json
{"inn":"7712345678","requested_amount":10000000,"term_months":36,"goal":"working_capital"}
```

Создание вернёт 201/SUBMITTED. Опрос GET /api/applications/{id} через ~4 секунды
покажет APPROVED, score=97, ставку 19% и сумму 10 000 000.
Для ИНН 500100732259: COUNTER_OFFER, score=46, ставка 24%, сумма 2 500 000.
Для 7723456789: REJECTED, score=8, причина «Высокая долговая нагрузка».

APPROVED подписывается POST /api/applications/{id}/sign с {"code":"1234"}.
COUNTER_OFFER сначала требует POST /api/applications/{id}/accept-offer.
После SIGNED автоматическая выдача занимает ещё один этап. Отказ не подписывается.
События, факторы, параметры и этапы включены в ответ заявки.
POST /api/demo/reset очищает заявки и сохраняет профили/материалы.

Для сбоя задайте SIMULATE_BKI_FAILURE=true перед запуском: заявка остановится
в NEEDS_RECHECK. Верните false и перезапустите процесс с той же БД — проверка продолжится.
При запуске используйте один worker. Данные, ключи идемпотентности и лимит
попыток подписания переживают перезапуск. История в демо общая для всех клиентов.

## Контракт и адаптеры

Для экспорта схемы из backend/: `python -m scripts.export_openapi`.
PyYAML нужен только для экспорта и контрактного теста, в runtime-lock его нет.
Банковские маршруты пока не включены в экспорт: они запланированы в Фазе 4.
Провайдеры выбираются настройками EGRUL_PROVIDER и BKI_PROVIDER;
для нового адаптера реализуйте соответствующий ABC и зарегистрируйте его
в integrations/providers.py и допустимых значениях Settings.
После этого переключение выполняется одной строкой env.

См. [план](../docs/BACKEND_PLAN.md), [правила](../docs/SCORING_SPEC.md)
и [общие эталонные кейсы](../docs/scoring_cases.json).
Уточнения API: [CONTRACT_CHANGES](../docs/CONTRACT_CHANGES.md),
ограничения и развитие: [REVIEW_NOTES](../docs/REVIEW_NOTES.md).
