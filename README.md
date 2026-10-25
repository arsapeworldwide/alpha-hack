# Умный кредитный кабинет предпринимателя

Прототип для хакатона Альфа-Банка / Changellenge: заявка на кредит,
объяснимый скоринг, встречное предложение, подписание и выдача.

Реализованы БД, seed, бизнес-логика, API и асинхронный конвейер.
Docker-сборка, запуск, healthcheck и сохранение данных после перезапуска проверены.
Банковская роль реализована. Фронтенд пока отсутствует.
Стек бэкенда: Python 3.12, FastAPI, SQLAlchemy, SQLite.
Код и Dockerfile находятся в backend/. Корневой requirements.txt ссылается
на backend/requirements.txt с точными версиями и хешами.

- [Бриф](docs/BACKEND_BRIEF.md)
- [Правила скоринга](docs/SCORING_SPEC.md)
- [План и допущения](docs/BACKEND_PLAN.md)
- [Черновик API](docs/openapi.yaml)
- [Состояние контракта](docs/API_CONTRACT.md)
- [Уточнения API](docs/CONTRACT_CHANGES.md)
- [Ограничения и развитие](docs/REVIEW_NOTES.md)
- [Интеграция фронтенда и nginx](docs/FRONTEND_INTEGRATION.md)
- [Сценарии для жюри](docs/TEST_SCENARIOS.md)
- [Коллекция запросов](docs/api_collection/backend.http)
- [Архитектура](docs/ARCHITECTURE.md), [состояния](docs/APPLICATION_STATES.md), [данные](docs/DATA_MODEL.md)
- [Бэкенд](backend/README.md)
- [Сторонние компоненты](THIRD_PARTY_NOTICES.md)

Все данные синтетические. ИНН могут случайно совпасть с реальными.
ЕГРЮЛ, БКИ, подписание и выдача реализованы как локальные симуляторы.
Код подписания — `1234`; почта, SMS и внешние сервисы в сценарии не используются.
Интернет потребуется для первоначальной загрузки образов и зависимостей;
в рантайме обращения в интернет не предусмотрены.

## Запуск в Docker

Нужны Docker с Linux-контейнерами и Docker Compose 2 или новее. Из корня репозитория:

```sh
docker compose up --build
```

Swagger: http://localhost:8000/api/docs, проверка: http://localhost:8000/api/health.
Seed загружается автоматически, `.env` не обязателен: используются безопасные
значения `.env.example`. SQLite хранится в именованном volume `backend_data`.
Перезапуск и обычный `docker compose down` сохраняют заявки.
Сервис frontend добавит фронтенд-разработчик; сейчас запускается только backend.

Проверено на Docker Desktop 4.96.3 / Linux Engine 29.9.2 / Compose 5.6.1:
контейнер healthy, три сценария дают числа из SPEC, заявки сохраняются после
перезапуска, сбой БКИ восстанавливается после пересоздания контейнера, reset работает.
Скоринг также проверен в отдельном контейнере с `--network none`.
API и банковская роль дополнительно проверены через отдельный тестовый nginx;
команда его запуска — в [инструкции интеграции](docs/FRONTEND_INTEGRATION.md).
Подробная проверка и ограничения: [backend/README.md](backend/README.md).

Банковская роль: в Swagger Authorize введите demo-bank-token, затем откройте
GET /api/bank/applications. Для решения сотрудника используйте action/comment
в POST /api/bank/applications/{id}/decision. Настройка — BANK_API_TOKEN через env.
