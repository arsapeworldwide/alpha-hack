# Архитектура

```mermaid
flowchart LR
    User[Предприниматель] --> Browser[Браузер]
    Bank[Сотрудник банка] --> Frontend
    Bank -. альтернативный API .-> Swagger[Swagger /api/docs]
    Browser --> Frontend[React frontend :8080]
    Frontend --> Nginx[nginx: /api без изменения пути]
    Browser -. прямой доступ в демо .-> API[FastAPI /api :8000]
    Swagger --> API
    Nginx --> API
    API --> Service[Сервисы заявок и банковского рассмотрения]
    API --> Access[Сессии и memberships: директор / бухгалтер / банк]
    Access --> DB
    API --> Controls[Демо-пульт БКИ: DEMO_MODE + права]
    Controls --> DB
    Service --> DB[(SQLite / PostgreSQL 16)]
    Service --> Files[Документы: volume /data/documents]
    API --> Products[Каталог трёх продуктов]
    Products --> DB
    Migrations[Alembic upgrade head] --> DB
    API --> Pipeline[asyncio pipeline: один процесс]
    Pipeline --> Egrul[ЕГРЮЛ: локальный симулятор]
    Pipeline --> Bki[БКИ: локальный симулятор + режим сбоя]
    Egrul --> DB
    Bki --> DB
    Pipeline --> Domain[Чистые scoring / decision / annuity]
    Pipeline --> DB
    Service --> Domain
    DB --> Events[application_events: system / client / bank]
```

Фронтенд объединён с origin/frontend; текущие доработки согласованы пользователем. Compose запускает оба сервиса;
localhost:8080 обслуживает интерфейс и /api через nginx, localhost:8000 — прямой API.
deploy/nginx.conf подключает исходный server-конфиг и убирает query string из access-log.
Для независимой проверки проксирования есть тестовый nginx на localhost:18080
через docker-compose.integration.yml; он не заменяет исходники фронтенда.
FastAPI управляет временем жизни БД и задач. На старте выполняются миграции Alembic,
дополняется seed и дозапускаются промежуточные заявки и SIGNED.

Каждая asyncio-задача ждёт паузу вне транзакции. Затем открывает короткую
сессию SQLAlchemy, изменяет статус и пишет событие одной транзакцией.
Общий lock координирует pipeline, клиентские действия, банковское рассмотрение и reset.
Синхронные операции с локальной БД выполняются в процессе API; расчёты малы.
Поддерживается одна реплика Uvicorn. Версия строки обнаруживает конфликт обновления,
но для нескольких процессов потребуются внешняя очередь и координация воркеров.

Domain не импортирует FastAPI, Pydantic и SQLAlchemy. HTTP-модели находятся
в schemas, адаптеры за ABC — в integrations, сохранение и сценарии — в services.
Данные компании фиксируются в snapshot заявки: последующая правка seed не меняет
уже рассчитанное решение. Новая заявка использует данные актуального профиля.

SQLite хранится в именованном Docker volume, код контейнера доступен только
для чтения, UID/GID — 10001. При штатной остановке задачи отменяются; этапы
восстанавливаются из сохранённых статусов, без необходимости хранить задачи в памяти.
Подписание и выдача — переходы состояний, реальные деньги не переводятся.
