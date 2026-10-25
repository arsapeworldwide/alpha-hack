# Модель данных

```mermaid
erDiagram
    companies ||--o{ applications : "company_inn"
    applications ||--o{ application_events : "журнал"
    applications ||--o{ factors : "объяснение"
    applications ||--o| application_workflows : "продукт и согласие"
    applications ||--o{ application_documents : "документы"
    products {
        string code PK
        string goal
        bigint min_amount
        bigint max_amount
        int min_term
        int max_term
        bigint auto_limit
    }
    application_workflows {
        string application_id PK,FK
        string product_code
        datetime consent_at
        json document_checklist
    }
    application_documents {
        int id PK
        string application_id FK
        string kind
        string path
        string media_type
        int size
        string sha256
        datetime created_at
    }
    users ||--o{ memberships : "участник"
    companies ||--o{ memberships : "доступ"
    users ||--o{ login_sessions : "сессия"
    users {
        string login PK
        string password_hash
        string full_name
        string role
        bool is_demo
    }
    memberships {
        string user_login PK,FK
        string company_inn PK,FK
    }
    login_sessions {
        string token_hash PK
        string user_login FK
        datetime expires_at
    }
    demo_failures {
        string source PK
        string mode
    }
    companies {
        string inn PK
        string name
        bigint annual_revenue
        bigint monthly_payments
        string credit_history
        int business_age_years
        string segment
        bool synthetic
    }
    applications {
        string id PK
        string company_inn FK
        json company_snapshot
        bigint requested_amount
        int term_months
        string goal
        string status
        datetime created_at
        datetime updated_at
        string idempotency_key UK
        string request_fingerprint
        int score
        decimal rate
        bigint offered_amount
        bigint monthly_payment
        bigint overpayment
        string rejection_reason
        json recommendations
        date reapply_date
        int sign_attempts
        bool manual_decision
        int version
    }
    application_events {
        int id PK
        string application_id FK
        datetime occurred_at
        string from_status
        string to_status
        string actor
        json details
    }
    factors {
        int id PK
        string application_id FK
        string code
        string name
        string points
        int maximum
        string explanation
    }
    feed_articles {
        string id PK
        string segment
        string title
        string summary
        string full_text
        string tag
        int reading_minutes
        int rejection_priority
        bool synthetic
    }
```

companies содержит пять синтетических компаний из seed фронтенда (три демо-профиля);
feed_articles — по пять своих материалов на retail/services/production и четыре
на general (тексты — backend/app/db/feed_articles.json, те же, что в моке фронтенда),
плюс три совета после отказа в каждом сегменте. Лента фильтруется по segment, прямой FK
к компании нет. rejection_priority задаёт порядок: советы 0–2 показываются только при
context=rejected и идут первыми, статьи сегмента — 10 и выше. Ответ — не больше 5 статей.

company_snapshot — копия данных профиля, использованных при проверках и расчёте.
Ключ идемпотентности уникален, отпечаток — SHA-256 нормализованного тела запроса.
Баллы факторов хранятся строками Decimal, чтобы SQLite не провёл дробь через float.
Суммы и платежи — целые рубли, ставка — Numeric(5,2). Время записывается в UTC.
SQLite возвращает naive datetime, схема ответа явно добавляет UTC.

Пара application_id/code уникальна в factors. Изменение статуса и событие
сохраняются вместе, actor принимает system/client/bank. Комментарий сотрудника
хранится в details события и доступен клиенту в полной заявке; в HTTP-логи он не пишется.
manual_decision отделяет ручной результат от автоматического, score и факторы
продолжают показывать исходную оценку риска.

Удаление applications каскадно удаляет события и факторы; компании и материалы
не удаляются. demo/reset отменяет активные задачи до очистки таблиц.
Схему SQLite и PostgreSQL обновляет Alembic. Reset каскадно удаляет workflow,
документы и файлы, но сохраняет каталог, пользователей, компании и ленту.
Срок ручной оферты хранится в details.offer банковского события; исходный срок
applications.term_months остаётся параметром заявки.
