# Бэкенд

Реализованы БД, синтетические данные, бизнес-логика, API и конвейер.
При старте выполняется Alembic upgrade head и добавляется seed; Swagger доступен на `/api/docs`.
Docker и банковская роль реализованы; API согласован с веткой frontend.
В P1 добавлены Bearer-сессии, роли, доступ по компаниям и демо-пульт БКИ.
Учётки и новые права: [P1_CONTRACT](../docs/P1_CONTRACT.md).

Стек: Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2.x,
SQLite с переключением через DATABASE_URL, pytest, httpx, ruff.

## Docker

Нужны Docker с Linux-контейнерами и Compose 2 или новее. Из корня репозитория:

```sh
docker compose up --build
```

После появления healthy в `docker compose ps` откройте http://localhost:8000/api/docs.
Для автоматизации можно использовать `docker compose up --build --wait`.
Копировать `.env.example` не обязательно. Для своих настроек создайте `.env`
в корне или задайте переменные окружения перед запуском compose.
Сайт доступен на http://localhost:8080, работает в API-режиме по умолчанию.
Compose включает сборку frontend и ожидание backend; в P1 добавлены вход и экран банка.
Пример интеграции nginx — [FRONTEND_INTEGRATION](../docs/FRONTEND_INTEGRATION.md).

Образ собирается из backend/Dockerfile, устанавливает runtime requirements.txt
с проверкой хешей и без dev-пакетов. API работает как UID/GID 10001, с одним worker.
Файловая система контейнера доступна только для чтения; /data — именованный volume,
/tmp — временная память. Healthcheck проверяет настоящий /api/health и доступ к БД.
Volume сохраняет SQLite при пересоздании контейнера и обычном compose down.
Для сброса заявок используйте POST /api/demo/reset — компании и лента сохранятся.
Операция требует входа директором демо-группы или сотрудником банка и DEMO_MODE=true.

Первичная сборка требует интернета для образа и Python-пакетов. После неё:
`docker compose up --no-build --pull never` работает с локальным образом без сети интернет.
Swagger также использует локальные JS/CSS.

Сборка и запуск подтверждены на Docker Desktop 4.96.3, Linux Engine 29.9.2
и Compose 5.6.1 (linux/amd64). Контейнер healthy, работает как 10001:10001,
SQLite доступен на запись в /data, приложение — только для чтения.
Три исхода, подписание, выдача, перезапуск, сбой БКИ и reset проверены через HTTP.
В отдельном контейнере с `--network none` прошли health и три исхода скоринга.
Бинарные зависимости разрешаются и для Linux arm64 (glibc >=2.28);
сборка и запуск на arm64 отдельно не проверялись.

## Проверка трёх сценариев и сохранения данных

Скрипт scripts/smoke_api.py использует только стандартную библиотеку Python
и реальные HTTP-запросы. Запускается с хоста из backend/ после готовности сервиса:

```sh
python -m scripts.smoke_api --report data/smoke-report.json
```

Каталог отчёта создаётся автоматически.
В локальном окружении вместо python используйте `.venv/Scripts/python.exe`
(Windows) или `.venv/bin/python` (Linux/macOS).
Скрипт создаёт три заявки, сверяет числа с docs/scoring_cases.json,
проверяет идемпотентность, неверный переход/код и выдачу. Заявки остаются в БД.
Опция `--reset` предварительно удаляет все существующие демо-заявки.

Из корня выполните `docker compose restart backend`, затем дождитесь healthy
в `docker compose ps`. Из backend/:

```sh
python -m scripts.smoke_api --verify-report data/smoke-report.json
```

Проверяются прежние ID, статусы, суммы, платежи и переплата без создания новых заявок.
Эта проверка прошла после перезапуска контейнера с тем же именованным volume:
сохранились прежние ID, статусы, суммы, платежи и переплата.
При другом BACKEND_PORT укажите `--base-url http://127.0.0.1:8001/api`.

Чтобы показать сбой БКИ в Docker, установите SIMULATE_BKI_FAILURE=true в корневом
`.env` и выполните `docker compose up -d --force-recreate backend`. Новая заявка
попадёт в NEEDS_RECHECK. Верните false и повторите команду: проверка продолжится.
Обычный compose restart не применяет изменения переменных окружения.

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
| DATABASE_URL | sqlite:///./data/credit.db | SQLite или postgresql+psycopg://... |
| DOCUMENT_DIRECTORY | ./data/documents | Каталог вложений; в Docker /data/documents |
| FRONTEND_PORT | 8080 | Публикуемый порт сайта |
| POSTGRES_PASSWORD | synthetic-postgres-password | Только для PostgreSQL overlay |
| BACKEND_PORT | 8000 | Публикуемый порт compose; внутри контейнера всегда 8000 |
| BANK_API_TOKEN | demo-bank-token | Токен банковской роли |
| PIPELINE_STEP_SECONDS | 1 | Пауза этапа, 0 в тестах |
| SIMULATE_BKI_FAILURE | false | Сбой БКИ и статус NEEDS_RECHECK |
| DEMO_MODE | true | Демо-учётки, карточки входа и пульт; false блокирует прежние демо-сессии |
| SESSION_HOURS | 8 | Срок серверной сессии (1–24 часа) |
| EGRUL_PROVIDER | simulator | Адаптер ЕГРЮЛ |
| BKI_PROVIDER | simulator | Адаптер БКИ |
| CORS_ORIGINS | localhost:5173 и localhost:8080 | JSON-массив разрешённых origin |
| LOG_LEVEL | INFO | DEBUG, INFO, WARNING, ERROR или CRITICAL |

В корневом `.env.example` путь DATABASE_URL предназначен для контейнера `/data`.
Для локального запуска оставьте значение по умолчанию из таблицы.
Драйвер psycopg и Alembic включены в lock. Для PostgreSQL используйте overlay
из корневого README. Его БД отдельная: перенос содержимого SQLite не выполняется.

## Архитектура и ограничения

`app/domain/` содержит обычные функции и dataclass без FastAPI, Pydantic и БД.
`app/db/` отвечает за SQLAlchemy и seed; `app/core/` — за настройки.
Месячный платёж округляется half-up; total_payment = monthly_payment * term_months,
overpayment = total_payment − approved_amount. Порядок согласован с пользователем и фронтендом.
Решение сравнивает неокруглённую максимальную сумму с запрошенной;
встречное предложение округляется вниз до 100 000 рублей.

Схему обновляет Alembic 0001, включая старую SQLite с CHECK статусов.
Воспроизводимая CLI-команда из backend/: `.venv/Scripts/alembic.exe upgrade head`
(Unix: `.venv/bin/alembic upgrade head`). DATABASE_URL берётся из env.
Перед обновлением нужна резервная копия; downgrade с удалением данных запрещён.
Миграция сохранения старых заявок, факторов и событий проверена отдельно.
ЕГРЮЛ, БКИ, подписание кодом 1234 и выдача — локальные симуляторы.
Все данные синтетические; ИНН могут случайно совпасть с реальными.
Все три исхода проверены через API и кликами в браузере на реальном бэкенде.

## Сквозная проверка API

Откройте http://localhost:8000/api/docs — Swagger работает с локальными JS/CSS.
Вызовите GET /api/demo-profiles и выберите профиль. POST /api/applications:

```json
{"company":{"inn":"7712345678","name":"ООО Альфа Ритейл","annual_revenue":180000000,"monthly_payments":400000,"credit_history":"excellent","business_age_years":7,"segment":"retail"},"requested_amount":10000000,"term_months":36,"goal":"working_capital","consent":true,"product_code":"WORKING_CAPITAL"}
```

Создание вернёт 201/SUBMITTED. Опрос GET /api/applications/{id} через ~4 секунды
покажет APPROVED, score=97, ставку 19% и сумму 10 000 000.
Для ИНН 500100732259: COUNTER_OFFER, score=46, ставка 24%, сумма 2 500 000.
Для 7723456789: REJECTED, score=8, причина «Высокая долговая нагрузка».

APPROVED подписывается POST /api/applications/{id}/sign с {"code":"1234"}.
COUNTER_OFFER сначала требует POST /api/applications/{id}/accept-offer.
После SIGNED автоматическая выдача занимает ещё один этап. Отказ не подписывается.
События включены в events, этапы — в pipeline, факторы и score — в decision.
POST /api/demo/reset очищает заявки и сохраняет профили/материалы.

Для сбоя задайте SIMULATE_BKI_FAILURE=true перед запуском: заявка остановится
в NEEDS_RECHECK. Верните false и перезапустите процесс с той же БД — проверка продолжится.
При запуске используйте один worker. Данные, ключи идемпотентности и лимит
попыток подписания переживают перезапуск. История доступна только участникам компании.

## Контракт и адаптеры

Для экспорта схемы из backend/: `python -m scripts.export_openapi`.
PyYAML и jsonschema нужны только для экспорта и контрактных тестов, в runtime-lock их нет.
Все 24 операции, включая продукты, документы, auth, банк и демо-пульт, включены в экспорт.
Ответы проверяются также по исходному контракту docs/frontend/openapi.yaml.
Провайдеры выбираются настройками EGRUL_PROVIDER и BKI_PROVIDER;
для нового адаптера реализуйте соответствующий ABC и зарегистрируйте его
в integrations/providers.py и допустимых значениях Settings.
После этого переключение выполняется одной строкой env.

## Банковская роль и документация

В Swagger выполните POST /api/auth/login, затем Authorize → SessionToken и вставьте
access_token. Для банка войдите underwriter, для клиента — director; пароль demo-credit-2026.
Старый BankToken/demo-bank-token поддерживается только в DEMO_MODE=true.
GET /api/bank/applications возвращает очередь с факторами; POST
/api/bank/applications/{id}/decision принимает action=approve|reject и comment (до 500 символов).
Без токена — 401. Комментарий виден в клиентском журнале, в логи не пишется.
Решение сотрудника помечено decided_by=bank и атомарно сохраняется с событием actor=bank.
approve при score от 45 одобряет исходную запрошенную сумму по ставке SPEC;
score и факторы не пересчитываются. Для score <45 ставка не определена — 409.
NEEDS_RECHECK без скоринга нельзя одобрить. После принятия предложения клиентом,
подписания и выдачи решение менять нельзя. Приём решений доступен до этих этапов.

Пошаговая проверка и ожидаемые числа — [TEST_SCENARIOS](../docs/TEST_SCENARIOS.md).
Все маршруты с примерами — [коллекция REST Client](../docs/api_collection/backend.http).
Откройте .http в VS Code с REST Client; запускайте блоки по порядку,
между созданием и подписанием дождитесь конечного решения опросом GET.
Для нового прогона коллекции сначала выполните reset в её конце.

Диаграммы: [архитектура](../docs/ARCHITECTURE.md),
[состояния](../docs/APPLICATION_STATES.md), [модель данных](../docs/DATA_MODEL.md).
Полные лицензии Python-зависимостей находятся в third_party_licenses/;
список и происхождение — [THIRD_PARTY_NOTICES](../THIRD_PARTY_NOTICES.md).
После обновления lock и установки dev-зависимостей из backend/:
`python -m scripts.export_notices`.

Для автоматического банковского прогона из backend/:
`python -m scripts.smoke_bank --report data/bank-report.json`.
После перезапуска контейнера: `python -m scripts.smoke_bank --verify-report data/bank-report.json`.
При своём токене задайте BANK_API_TOKEN в окружении скрипта; значение токена не печатается.

См. [правила](../docs/SCORING_SPEC.md)
и [общие эталонные кейсы](../docs/scoring_cases.json).
Контракт API: [API_CONTRACT](../docs/API_CONTRACT.md),
ограничения и развитие: [REVIEW_NOTES](../docs/REVIEW_NOTES.md).


## Обновление после демо

[Контракт](../docs/API_CONTRACT.md): публичные компании без БКИ,
обязательное consent=true, GET /products, counter/request_info в банковском решении,
INFO_REQUESTED и MANUAL_REVIEW. По умолчанию банковский UI показывает только
встречные предложения, ручное рассмотрение и повторную проверку.
В API старый view=reviewable оставлен для совместимости, новый view=needs_decision
соответствует UI. view=all включает также завершённые заявки.

Документы загружаются multipart, проверяются размер, MIME и сигнатура; файл
хранится под случайным именем, SHA-256 и метаданные — в БД. Скачать могут только
пользователь с доступом к компании или банк. Файл — подтверждение в демо:
OCR, анализ содержимого, антивирус и проверка подлинности не реализованы.
Повторный конвейер рассчитывает исходные условия, не условия прошлой ручной оферты.

`python -m app.preflight` проверяет health/БД, вход, БКИ, профили и продукты.
Он не сбрасывает заявки и не меняет режим БКИ. После включения сбоя его нужно
выключить пультом: простой рестарт сохраняет выбранный режим.
