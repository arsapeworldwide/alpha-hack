# Состояния заявки

Источник разрешённых переходов — backend/app/domain/state_machine.py.
Все времена в API — UTC, каждый переход сохраняется с актором и деталями.
Диаграмма согласована с контрактом origin/frontend; исходная версия сохранена в docs/frontend/.

```mermaid
stateDiagram-v2
    [*] --> DRAFT
    DRAFT --> SUBMITTED: client
    SUBMITTED --> CHECKING_EGRUL: system
    CHECKING_EGRUL --> CHECKING_BKI: system, компания найдена
    CHECKING_EGRUL --> REJECTED: system, компания не найдена
    CHECKING_BKI --> SCORING: system, БКИ доступно
    CHECKING_BKI --> NEEDS_RECHECK: system, БКИ недоступно
    NEEDS_RECHECK --> CHECKING_BKI: client retry / system после старта
    SCORING --> APPROVED: system
    SCORING --> COUNTER_OFFER: system
    SCORING --> REJECTED: system
    APPROVED --> SIGNED: client, верный код
    COUNTER_OFFER --> OFFER_ACCEPTED: client
    OFFER_ACCEPTED --> SIGNED: client, верный код
    SIGNED --> DISBURSED: system
    DISBURSED --> [*]
    APPROVED --> REJECTED: bank
    APPROVED --> APPROVED: bank, подтверждение
    COUNTER_OFFER --> APPROVED: bank
    COUNTER_OFFER --> REJECTED: bank
    REJECTED --> APPROVED: bank, score от 45
    REJECTED --> REJECTED: bank, подтверждение
    NEEDS_RECHECK --> REJECTED: bank
```

POST создания возвращает SUBMITTED, DRAFT используется внутри транзакции создания
и виден в журнале. Между автоматическими этапами — PIPELINE_STEP_SECONDS (по умолчанию 1).
Автоматическое решение — завершение SCORING, включая отказ; сбой БКИ — failed этап проверки.
История повторной проверки остаётся в events; pipeline показывает последнюю попытку этапа.

COUNTER_OFFER нельзя подписать до принятия. APPROVED подписывается напрямую; accept-offer даёт 409.
SIGNED сохраняется до выдачи; после перезапуска эта выдача дозапускается.
Неверный четырёхзначный код не меняет статус и расходует одну попытку из пяти.
Первые четыре неверные попытки дают 400, пятая и последующие — 429. Неверный формат — 422 без расхода попытки.

Банк рассматривает APPROVED, COUNTER_OFFER, REJECTED и NEEDS_RECHECK.
После OFFER_ACCEPTED, SIGNED или DISBURSED решение менять нельзя.
Во время автоматических проверок сотрудник не вмешивается: возвращается 409.
NEEDS_RECHECK без результата скоринга нельзя одобрить (409/INVALID_TRANSITION, details.reason=BANK_SCORING_REQUIRED).
Формальный переход NEEDS_RECHECK → APPROVED в state_machine требует уже имеющегося
скоринга; в обычном конвейере MVP при NEEDS_RECHECK score отсутствует.

Ручное approve при score от 45 одобряет исходную запрошенную сумму по ставке SPEC,
перекрывая ограничение платёжной способности. Исходные score и факторы сохраняются.
Для score ниже 45 ставка не определена: 409/INVALID_TRANSITION,
details.reason=BANK_RATE_UNAVAILABLE, заявка не меняется.
Подтверждение того же решения банком записывается отдельным событием с комментарием.
Отказ не переводится обратно в SUBMITTED: повторная подача создаёт новую заявку.

Невозможный переход возвращает 409/INVALID_TRANSITION с понятным названием статусов.
