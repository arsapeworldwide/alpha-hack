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
