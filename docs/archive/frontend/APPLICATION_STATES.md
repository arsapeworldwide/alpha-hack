# Состояния заявки

Таблица переходов одна на фронтенд и бэкенд: `frontend/src/api/stateMachine.ts` и `backend/.../domain/state_machine.py`. Недопустимый переход сервер отклоняет с кодом 409 `INVALID_TRANSITION`.

```mermaid
stateDiagram-v2
    [*] --> DRAFT: клиент заполняет анкету
    DRAFT --> SUBMITTED: POST /applications
    SUBMITTED --> CHECKING_EGRUL: сервер, сразу
    CHECKING_EGRUL --> CHECKING_BKI: реквизиты сверены (1 с)
    CHECKING_EGRUL --> NEEDS_RECHECK: реестр не ответил
    CHECKING_BKI --> SCORING: история получена (1 с)
    CHECKING_BKI --> NEEDS_RECHECK: БКИ не ответило
    NEEDS_RECHECK --> CHECKING_EGRUL: POST /retry
    NEEDS_RECHECK --> CHECKING_BKI: POST /retry
    SCORING --> APPROVED: max_amount ≥ запрошенной
    SCORING --> COUNTER_OFFER: floor_100k(max_amount) ≥ 300 000
    SCORING --> REJECTED: score < 45, нет платёжной способности или сумма слишком мала
    COUNTER_OFFER --> OFFER_ACCEPTED: POST /accept-offer
    APPROVED --> SIGNED: POST /sign {code: 1234}
    OFFER_ACCEPTED --> SIGNED: POST /sign {code: 1234}
    SIGNED --> DISBURSED: сервер, через 1 с
    REJECTED --> [*]
    DISBURSED --> [*]
```

| Статус | Что видит клиент | Кто переводит дальше | Шаг экрана |
|---|---|---|---|
| DRAFT | Черновик (только в интерфейсе) | клиент — «Отправить заявку» | 1–2 |
| SUBMITTED | Заявка отправлена | сервер | 3 |
| CHECKING_EGRUL | Проверка в ЕГРЮЛ | сервер | 3 |
| CHECKING_BKI | Запрос в БКИ | сервер | 3 |
| SCORING | Скоринг | сервер | 3 |
| NEEDS_RECHECK | Нужна повторная проверка | клиент — «Повторить проверку» | 3 |
| APPROVED | Одобрено | клиент — подписание | 4 |
| COUNTER_OFFER | Встречное предложение | клиент — «Принять новые условия» | 4 |
| OFFER_ACCEPTED | Условия приняты | клиент — подписание | 4 |
| REJECTED | Отказ (финальный) | — | 4 |
| SIGNED | Договор подписан | сервер (выдача) | 4 |
| DISBURSED | Кредит выдан (финальный) | — | 4 |

Пока заявка в статусах SUBMITTED, CHECKING_*, SCORING или SIGNED, интерфейс раз в 700 мс запрашивает `GET /applications/{id}`. Таймеров этапов в интерфейсе нет. Подписание: 5 неверных попыток → 429 `TOO_MANY_ATTEMPTS`.
