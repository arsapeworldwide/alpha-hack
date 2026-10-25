import json
from pathlib import Path

COMPANIES = (
    {
        "inn": "7712345678",
        "name": "ООО «Альфа Ритейл»",
        "annual_revenue": 180_000_000,
        "monthly_payments": 400_000,
        "credit_history": "excellent",
        "business_age_years": 7,
        "segment": "retail",
    },
    {
        "inn": "500100732259",
        "name": "ИП Иванов",
        "annual_revenue": 24_000_000,
        "monthly_payments": 400_000,
        "credit_history": "fair",
        "business_age_years": 3,
        "segment": "services",
    },
    {
        "inn": "7723456789",
        "name": "ООО «Вектор»",
        "annual_revenue": 9_000_000,
        "monthly_payments": 300_000,
        "credit_history": "poor",
        "business_age_years": 1,
        "segment": "production",
    },
)

REGISTRY_EXTRAS = (
    {
        "inn": "7734567890",
        "name": "ООО «Северный Цех»",
        "annual_revenue": 60_000_000,
        "monthly_payments": 500_000,
        "credit_history": "excellent",
        "business_age_years": 4,
        "segment": "production",
    },
    {
        "inn": "500200111111",
        "name": "ИП Смирнова",
        "annual_revenue": 12_000_000,
        "monthly_payments": 50_000,
        "credit_history": "fair",
        "business_age_years": 2,
        "segment": "services",
    },
)

# Отдельные тексты по сегментам не создают впечатление настоящих банковских советов.
# Материалы «Умной ленты» лежат в feed_articles.json — тот же текст использует мок фронтенда
# (frontend/src/api/feedSeed.ts). У каждого сегмента свои статьи; advice — советы после отказа.
FEED_ARTICLES = json.loads(
    (Path(__file__).with_name("feed_articles.json")).read_text(encoding="utf-8")
)
