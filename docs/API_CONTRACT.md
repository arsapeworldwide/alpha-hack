# ЧЕРНОВИК бэкенда, сверить с контрактом фронтенда

Фронтенд-контракт ещё не предоставлен. Это черновик реализованного API бэкенда;
все уточнения перечислены в [CONTRACT_CHANGES.md](CONTRACT_CHANGES.md).
Точная машинная схема: [openapi.yaml](openapi.yaml), Swagger: `/api/docs`.
Все данные синтетические, история общая для демо, клиентская авторизация отсутствует.

| Метод и путь (под /api) | Запрос | Успешный ответ |
|---|---|---|
| GET /health | — | 200: status, database, synthetic |
| GET /demo-profiles | — | 200: массив компаний |
| GET /companies/lookup | inn (10 или 12 цифр) | 200: found, company, message |
| POST /applications | inn, requested_amount, term_months, goal | 201: заявка SUBMITTED |
| GET /applications | limit=50, offset=0 | 200: массив заявок, новые первыми |
| GET /applications/{id} | UUID | 200: полная заявка |
| POST /applications/{id}/accept-offer | без тела | 200: OFFER_ACCEPTED |
| POST /applications/{id}/sign | code — строка из 4 цифр | 200: SIGNED |
| GET /feed | segment=general, context=rejected (необязательный) | 200: массив материалов |
| POST /demo/reset | без тела | 200: deleted_applications, message |
| GET /bank/applications | X-Bank-Token, limit=50, offset=0 | 200: очередь с полными заявками |
| POST /bank/applications/{id}/decision | X-Bank-Token, action, comment | 200: полная заявка |

Сумма: целое число 300 000–15 000 000, срок: целое число 3–36,
для cash_gap не больше 12. goal: working_capital, equipment, cash_gap.
segment: retail, services, production, general.
Неизвестные поля тела запрещены. При неверном формате возвращается 422.

Создание поддерживает `Idempotency-Key` (1–200 видимых ASCII-символов без пробелов).
Повтор того же тела с тем же ключом возвращает 200 с текущей заявкой;
несовпадение тела возвращает 409. Ключ и счётчик попыток хранятся в БД.

Полная заявка: id, status, status_label, message, created_at, updated_at, company,
parameters (requested_amount, term_months, goal), stages, decision, score, factors,
rejection_reason, recommendations, reapply_date, sign_attempts_remaining, events.
decision содержит status, annual_rate, amount, monthly_payment, overpayment, manual;
до принятия решения decision=null. После отказа финансовые поля decision равны null.
После подписания status меняется, а decision.status сохраняет итог решения.
Баллы факторов и annual_rate — строки Decimal, деньги — целые рубли.
Даты/время — UTC ISO 8601, дата повторной подачи — календарная дата.

stages содержит SUBMITTED, CHECKING_EGRUL, CHECKING_BKI, SCORING;
каждый этап имеет code, name, state (pending/active/completed/failed), started_at,
finished_at. Отказ по скорингу означает completed; недоступность БКИ — failed.
При повторе БКИ этап показывает последнюю попытку, полная история остаётся в events.
events содержит id, occurred_at, from_status, to_status, actor, details.

APPROVED можно подписать сразу. COUNTER_OFFER сначала принимается.
SIGNED автоматически переходит в DISBURSED; при нулевой паузе тесты могут увидеть
выдачу уже при первом GET. Пять неверных кодов — 400, шестой запрос — 429.
Неизвестный ИНН в lookup даёт 200 с found=false; создание для него даёт 404.
NEEDS_RECHECK восстанавливается после выключения сбоя и перезапуска сервиса.

Ошибки: `{code, message, details}`. Заголовок X-Request-ID возвращается в ответе
и доступен через CORS; входящий корректный request-id сохраняется.

| HTTP | code |
|---|---|
| 400 | INVALID_SIGN_CODE |
| 401 | BANK_UNAUTHORIZED |
| 404 | APPLICATION_NOT_FOUND, COMPANY_NOT_FOUND, NOT_FOUND |
| 405 | METHOD_NOT_ALLOWED |
| 409 | INVALID_TRANSITION, IDEMPOTENCY_CONFLICT, UPDATE_CONFLICT, BANK_RATE_UNAVAILABLE, BANK_SCORING_REQUIRED |
| 422 | VALIDATION_ERROR |
| 429 | SIGN_ATTEMPTS_EXCEEDED |
| 500 | INTERNAL_ERROR |
| 503 | DATABASE_UNAVAILABLE |

Банковские маршруты реализованы, X-Bank-Token соответствует BANK_API_TOKEN из env
(демо: demo-bank-token). OpenAPI содержит схему безопасности BankToken для Swagger Authorize.
Очередь включает APPROVED, COUNTER_OFFER, REJECTED и NEEDS_RECHECK,
порядок — по updated_at от старых к новым, затем ID; limit=1–100, offset от 0.
Ручные результаты остаются в очереди для пересмотра до принятия предложения клиентом.

Тело решения: {action: approve|reject, comment}, комментарий обязателен,
1–1000 символов после удаления пробелов по краям. Неизвестные поля запрещены.
approve при score от 45 одобряет исходную запрошенную сумму по ставке SPEC
для сохранённых score/goal, с пересчётом платежа и переплаты. Ограничение capacity
в этом случае перекрывает сотрудник. Score и факторы остаются исходными.
При score <45 — 409/BANK_RATE_UNAVAILABLE, без скоринга — 409/BANK_SCORING_REQUIRED.
reject очищает финансовые поля и задаёт причину ручного отказа, рекомендации и дату +3 месяца.
После OFFER_ACCEPTED, SIGNED и DISBURSED, а также в ходе проверок — 409/INVALID_TRANSITION.
Подтверждение уже текущего APPROVED/REJECTED допустимо и добавляет событие.
В журнале actor=bank, details содержит action/comment, previous_decision и новые условия.
decision.manual=true; ручной результат сохраняется после перезапуска.
Комментарий виден клиенту в журнале заявки — это не приватная заметка сотрудника.

После получения контракта фронтенда он приоритетнее этого черновика,
если не противоречит SCORING_SPEC.
