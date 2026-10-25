# Контракт API

Полное описание со схемами — `docs/openapi.yaml` (OpenAPI 3.1, проверен `openapi-spec-validator`). Этот файл — краткая выжимка. Фронтенд реализует контракт дважды: мок (`frontend/src/api/mockApi.ts`) и HTTP-клиент (`frontend/src/api/httpApi.ts`); бэкенд реализует его на FastAPI.

## Общие правила

- Все маршруты под `/api`. JSON, UTF-8.
- Деньги — целые рубли, ставка — число в % годовых (19, 21.5, 24). Даты — ISO 8601.
- Ошибки всегда `{code, message, details}`; `message` — понятный текст на русском, без стек-трейсов.
- Коды: `VALIDATION_ERROR` 422, `NOT_FOUND` 404, `COMPANY_NOT_FOUND` 404, `INVALID_TRANSITION` 409, `INVALID_SIGN_CODE` 400 (`details.attempts_left`), `TOO_MANY_ATTEMPTS` 429, `UNAUTHORIZED` 401.

## Маршруты

| Метод и путь | Назначение | Ответ |
|---|---|---|
| `GET /health` | Живость | `{status: "ok"}` |
| `GET /demo-profiles` | Три демо-компании | `DemoProfile[]` |
| `GET /companies/lookup?inn=` | Поиск в синтетическом ЕГРЮЛ | `Company` или 404 `COMPANY_NOT_FOUND` |
| `POST /applications` + `Idempotency-Key` | Отправить заявку (вся карточка компании + сумма, срок, цель) | 201 `Application` в `SUBMITTED`; повтор ключа — 200 та же заявка |
| `GET /applications` | «Мои заявки», новые сверху | `ApplicationSummary[]` |
| `GET /applications/{id}` | Заявка с этапами, решением и факторами (опрашивается раз в 700 мс) | `Application` |
| `POST /applications/{id}/accept-offer` | Принять встречное (`COUNTER_OFFER → OFFER_ACCEPTED`) | `Application` |
| `POST /applications/{id}/sign {code}` | Подписать (из `APPROVED`/`OFFER_ACCEPTED`), код 1234, 5 попыток | `Application` в `SIGNED`, затем сервер сам → `DISBURSED` |
| `POST /applications/{id}/retry` | Повторить проверки из `NEEDS_RECHECK` | `Application` |
| `GET /feed?segment=&context=` | Лента; `context=rejected` — сначала советы | `FeedResponse` с `reason` и `synthetic: true` |
| `POST /demo/reset` | Удалить все заявки | `{status, removed_applications}` |
| `GET /bank/applications` | Очередь для сотрудника (`X-Bank-Token`) | `Application[]` |
| `POST /bank/applications/{id}/decision` | Ручное решение `{action, comment}` | `Application` |

## Объект решения (`Application.decision`)

`outcome`, `score`, `factors[]` (`code, name, points, max_points, explanation`), `rate`, `approved_amount`, `term_months`, `monthly_payment`, `total_payment`, `overpayment`, `max_amount`, `capacity`, `debt_ratio`, `rejection_reason`, `recommendations[]`, `reapply_date`, `decided_by`, `bank_comment`. До окончания скоринга `decision = null`.

## Отличия от черновика бэкенда

Черновик содержал только список маршрутов. Добавлены схемы, коды ошибок, `retry` для `NEEDS_RECHECK`, параметр `context` у ленты, поля `status_label`, `goal_label`, `pipeline[]`, `sign_attempts_left`, `error_message`.

## Реализация бэкенда после интеграции (25.10.2026)

Исходный документ и OpenAPI ветки frontend сохранены в docs/frontend/ без изменений.
docs/openapi.yaml экспортируется из FastAPI; пути в экспорте уже содержат /api,
а в исходном документе этот префикс указан через servers. Итоговые URL одинаковы.
Ответы реального сервера проверяются jsonschema по исходным схемам фронтенда.

Согласованное округление: сначала monthly_payment half-up до целых рублей,
затем total_payment = monthly_payment * term_months и overpayment = total_payment − approved_amount.
Деньги во всех расчётах сервера — int/Decimal. В JSON число для ставки, баллов
и debt_ratio используется только как отображение уже рассчитанных значений.

Добавлено поле events для требуемого журналирования; исходный frontend его игнорирует.
Для ручного отказа до завершения проверок score может быть null, factors пустой:
это явно означает отсутствие скоринга, а не выдуманную оценку 0.
Для обычных трёх исходов score всегда integer, как в исходной схеме.

Согласованное ранее правило банка сохранено: approve при score <45 запрещён.
Код 409 — INVALID_TRANSITION, диагностическая причина BANK_RATE_UNAVAILABLE
или BANK_SCORING_REQUIRED находится в details.reason. Остальные внутренние коды
также приводятся к публичному ErrorCode исходного контракта.
Пятый неверный код подписания возвращает 429/TOO_MANY_ATTEMPTS и attempts_left=0.

В реальном режиме компания и БКИ перепроверяются по синтетическому реестру:
3 демо-профиля и 2 дополнительных примера из frontend/src/api/seed.ts.
Показатели после проверки могут отличаться от вручную введённого предварительного прогноза.
Для неизвестного ИНН lookup и создание дают мягкую ошибку COMPANY_NOT_FOUND (404).
