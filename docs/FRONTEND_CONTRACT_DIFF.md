# Сверка ветки frontend с бэкендом (25.10.2026)

Исходная ветка: origin/frontend, commit 0978566.
Интеграционная ветка: integration/frontend-backend от backend/100ebda.
Исходные файлы frontend/ переносятся без правок. Документы фронтенда сохранены
в docs/frontend/; в SCORING_SPEC отличий между ветками нет.

## Принцип интеграции

Контракт фронтенда приоритетнее прежнего черновика бэкенда по структуре API.
Переходы, сохранение в БД, идемпотентность, журнал и domain-логика остаются серверными.
Режим сборки фронтенда должен быть VITE_USE_MOCK=false, иначе UI будет использовать localStorage.

| Область | Бэкенд до интеграции | Контракт frontend |
|---|---|---|
| Демо-профили | Company[] | DemoProfile[] с company, id, label, risk_level |
| Lookup | found/company/message | Company или мягкая ошибка COMPANY_NOT_FOUND 404 |
| Создание | inn + параметры | company + параметры |
| Заявка | parameters/stages, score и factors сверху | параметры сверху, pipeline и decision со score/factors |
| Этапы | 4 этапа, uppercase code | 3 этапа egrul/bki/scoring, pending/in_progress/done/failed |
| Ставка/баллы | десятичные строки | JSON number; денежные суммы остаются integer |
| История | полная Application[] | ApplicationSummary[] |
| Лента | массив статей | FeedResponse с items, segment_label и reason |
| Сброс | deleted_applications/message | status/removed_applications |
| Сбой БКИ | восстановление при старте | дополнительно POST /applications/{id}/retry |
| Ошибки | BANK_UNAUTHORIZED, APPLICATION_NOT_FOUND и другие | UNAUTHORIZED, NOT_FOUND, TOO_MANY_ATTEMPTS |
| Код подписи | details.attempts_remaining | details.attempts_left |
| Банковский результат | manual/status | decided_by/outcome/bank_comment |

## Согласованное округление переплаты

Бэкенд округляет payment и P*n−S независимо от точного аннуитетного P.
Фронтенд сначала округляет месячный платёж, затем умножает на n.
Платежи совпадают, переплата различается:

| Профиль | Бэкенд | Фронтенд |
|---|---|---|
| Альфа Ритейл | 3 196 167 | 3 196 160 |
| ИП Иванов | 1 030 957 | 1 030 952 |

Пользователь выбрал порядок фронтенда: округлить месячный платёж, затем умножить
на срок. Обновлены бэкенд, эталоны и документация; frontend/ не изменялся.
Баллы 97/46/8, ставки и исходы, включая 2 500 000, одинаковы.

## Проверки после адаптации

- Полный API в реальном режиме, без мока браузера.
- Генерируемая схема и контракт frontend, с нормализацией префикса servers=/api.
- pytest/ruff бэкенда, test/lint/build фронтенда без изменения его файлов.
- docker compose up --build, реальные страницы через nginx frontend.
- Три исхода, подписание, выдача, история, reset, БКИ/retry и перезапуск.
- Проверка отсутствия diff в frontend/ относительно origin/frontend.

Результат: формат API приведён к frontend, добавлен retry. 194 теста Python,
60 тестов фронтенда, ruff, ESLint и build прошли. Через реальный браузер
пройдены три исхода, подписание, выдача, reload, история, reset и БКИ/retry/recovery.
Дополнения API events и nullable score при ручном отказе до скоринга описаны
в CONTRACT_CHANGES.md. Исходный frontend-контракт сохранён как контрольный артефакт.
