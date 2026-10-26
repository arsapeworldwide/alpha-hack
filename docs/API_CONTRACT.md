# Контракт API

Полные схемы — [OpenAPI 3.1](openapi.yaml), экспортированный из FastAPI.
[Коллекция запросов](api_collection/backend.http) содержит примеры операций.
Все пути ниже имеют префикс /api, JSON — UTF-8. Даты — ISO 8601/UTC,
деньги — целые рубли; ставка в ответе — число процентов годовых.

## Доступ и ошибки

POST /auth/login возвращает Bearer-токен; запросы заявок требуют
Authorization: Bearer <token>. Чужая заявка — 404, недостаточные полномочия — 403,
нет сессии — 401. Права и учётки описаны в [контракте ролей](P1_CONTRACT.md).
Банк использует сессию underwriter; X-Bank-Token оставлен для совместимости при DEMO_MODE=true.

Единый ответ ошибки: {code, message, details}, без traceback. Основные коды:
VALIDATION_ERROR (422), NOT_FOUND/COMPANY_NOT_FOUND (404), INVALID_TRANSITION (409),
INVALID_SIGN_CODE (400), TOO_MANY_ATTEMPTS (429), UNAUTHORIZED (401).
Подробные схемы и допустимые ответы каждой операции — в OpenAPI.

## Операции

| Метод и путь | Назначение |
|---|---|
| GET /health | API и БД: status=ok, database=ok, synthetic=true |
| GET /demo-profiles | Три реестровых демо-профиля без кредитных полей |
| GET /companies/lookup?inn= | Поиск в синтетическом реестре; неизвестный ИНН — 404 |
| GET /products | WORKING_CAPITAL, INVEST, OVERDRAFT |
| POST /auth/login | Вход: login/password |
| GET /auth/me | Текущий пользователь и доступ |
| POST /auth/logout | Отозвать сессию |
| POST /applications | Создать заявку; Idempotency-Key, 201/SUBMITTED |
| GET /applications | История доступных заявок |
| GET /applications/{id} | Полная заявка, этапы, решение, документы, журнал |
| POST /applications/{id}/accept-offer | Принять COUNTER_OFFER |
| POST /applications/{id}/sign | Подписать APPROVED/OFFER_ACCEPTED: {code} |
| POST /applications/{id}/retry | Повторить БКИ из NEEDS_RECHECK |
| POST /applications/{id}/documents | Загрузить документ: multipart kind/file/consent |
| GET /applications/{id}/documents/{document_id} | Скачать с проверкой доступа |
| GET /feed?segment=&context= | Лента; context=rejected выводит советы первыми |
| POST /demo/reset | Удалить демо-заявки/документы, сохранить seed |
| GET /demo/failures | Текущий режим БКИ |
| POST /demo/failures | Пульт: {bki: ok или down} |
| GET /bank/applications?view= | Очередь банка |
| GET /bank/applications/{id} | Карточка банка с рекомендацией системы |
| POST /bank/applications/{id}/decision | approve/reject/counter/request_info |
| GET /bank/applications/{id}/documents/{document_id} | Скачать файл сотрудником |

## Заявка и согласие

Тело POST /applications: company с реестровыми полями, requested_amount, term_months,
goal и обязательное consent=true. product_code опционален: без него продукт определяется
по goal. Отсутствие согласия, false и неверный тип — 422. Время согласия и событие
сохраняются в БД. Компания перепроверяется сервером; поля клиента не подменяют seed.
До согласия публичные lookup/demo-profiles не возвращают monthly_payments/credit_history.

| Продукт | goal | Сумма | Срок | Базовая ставка | Лимит автоматического решения |
|---|---|---|---|---|---|
| WORKING_CAPITAL | working_capital | 300 тыс.–15 млн ₽ | 3–36 мес. | 19% | 12 млн ₽ |
| INVEST | equipment | 300 тыс.–15 млн ₽ | 3–36 мес. | 17% | 5 млн ₽ |
| OVERDRAFT | cash_gap | 300 тыс.–5 млн ₽ | 3–12 мес. | 21% | 5 млн ₽ |

Надбавки определяет SPEC. Сумма/срок и соответствие продукта цели проверяются сервером.
Повтор Idempotency-Key с тем же запросом возвращает 200 и прежнюю заявку;
другой запрос с тем же ключом — конфликт. Ключ изолирован по пользователю.
Конвейер сохраняет этапы; клиент опрашивает GET полной заявки.

## Объект решения (Application.decision)

outcome, score, factors[] (code/name/points/max_points/explanation), rate,
approved_amount, term_months, monthly_payment, total_payment, overpayment,
max_amount, capacity, debt_ratio, rejection_reason, recommendations[], reapply_date,
decided_by, bank_comment. До завершения скоринга и в MANUAL_REVIEW/INFO_REQUESTED
клиентское decision=null. Ручной отказ до скоринга может иметь score=null и пустые факторы.

Monthly payment округляется half-up до рубля. total_payment = monthly_payment × term_months,
overpayment = total_payment − approved_amount. Факторы и баллы трёх эталонов — SPEC.
Все расчёты сервера — int/Decimal; JSON-числа служат отображением результата.

APPROVED подписывается напрямую, COUNTER_OFFER требует accept-offer (иначе 409).
Код — 1234: неверный четырёхзначный код расходует попытку, пятая и следующие — 429.
Неверный формат — 422 без расхода. SIGNED автоматически переходит в DISBURSED.
[Диаграмма состояний](APPLICATION_STATES.md) описывает остальные переходы.

## Решения сотрудника банка

view=needs_decision: COUNTER_OFFER, NEEDS_RECHECK, MANUAL_REVIEW; это вкладка UI
по умолчанию. view=all включает завершённые заявки. API без view сохраняет
совместимый reviewable. Ответ содержит system_recommendation, waiting_minutes,
capacity_excess и policy_rate; рекомендация рассчитывается по исходным параметрам.

POST решения принимает action и comment (до 500 символов). Counter требует
amount 300000–15000000 и term_months 3–36; для cash_gap срок не выше 12 месяцев.
Ставка определяется по SPEC. Превышение capacity требует непустого обоснования (422).
Для score <45 одобрение/оферта запрещены: 409/INVALID_TRANSITION,
details.reason=BANK_RATE_UNAVAILABLE. Без скоринга — BANK_SCORING_REQUIRED.

Рассматриваемые статусы: APPROVED/COUNTER_OFFER/REJECTED/NEEDS_RECHECK/MANUAL_REVIEW.
После OFFER_ACCEPTED/SIGNED/DISBURSED пересмотр запрещён. Reviewer, комментарий,
прежние и новые условия сохраняются в events. Комментарий видит клиент.
Исходные параметры заявки не затираются; срок ручной оферты возвращается
в decision.term_months и хранится в банковском событии details.offer.

## Документы и ручное рассмотрение

Сумма к выдаче выше auto_limit продукта или рейтинг C при сумме выше 5 млн
переводят автоматический результат в MANUAL_REVIEW. Клиент ждёт специалиста,
банк видит рекомендацию. Золотые сценарии 97/46/8 не попадают под новые ограничения.

Request_info с непустым checklist переводит неподписанную заявку в INFO_REQUESTED.
Директор загружает multipart kind/file/consent=true; бухгалтер просматривает/скачивает.
PDF/PNG/JPEG до 10 МиБ, проверяются MIME и сигнатура; тип/сигнатура/согласие — 422,
размер выше лимита — 413. Исходное имя файла не используется, метаданные и SHA-256 в БД.
Загрузка полного списка запускает ЕГРЮЛ → БКИ → скоринг; факторы пересчитываются
без дублирования, используются исходные условия, не прежняя ручная оферта.

Скачать могут пользователи компании и банк: attachment, no-store, nosniff;
чужая заявка/файл — 404. Reset удаляет связанные файлы. Данные синтетические:
OCR и проверка подлинности не реализованы, содержимое выписки не меняет реестр.
