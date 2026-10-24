# Бэкенд

Фаза 1: реализованы конфигурация, БД, синтетические данные и чистая бизнес-логика.
При старте создаются таблицы и добавляется seed; Swagger доступен на `/api/docs`.
Маршруты бизнес-сценария и фоновый конвейер будут добавлены в Фазе 2.

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
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

macOS / Linux:

```sh
.venv/bin/python -m pip install --require-hashes -r requirements-dev.txt
.venv/bin/python -m pytest -q
.venv/bin/ruff check .
.venv/bin/ruff format --check .
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
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
| PIPELINE_STEP_SECONDS | 1 | Пауза этапа, 0 в тестах (Фаза 2) |
| SIMULATE_BKI_FAILURE | false | Сбой БКИ (Фаза 2) |
| CORS_ORIGINS | localhost:5173 и localhost:8080 | JSON-массив разрешённых origin |
| LOG_LEVEL | INFO | Уровень логирования (Фаза 2) |

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
ЕГРЮЛ, БКИ, подписание кодом 1234 и выдача — запланированные локальные симуляторы.
Все данные синтетические; ИНН могут случайно совпасть с реальными.
Docker и полный сценарий пока не проверены и будут готовы в следующих фазах.

См. [план](../docs/BACKEND_PLAN.md), [правила](../docs/SCORING_SPEC.md)
и [общие эталонные кейсы](../docs/scoring_cases.json).
