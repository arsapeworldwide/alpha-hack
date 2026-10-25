# Сторонние компоненты и симуляторы

Список экспортирован из зафиксированных requirements и metadata установленных wheels.
Полные оригинальные тексты лицензий скопированы в backend/third_party_licenses/.
Обновление из backend/: python -m scripts.export_notices (после установки dev-lock).

| Компонент | Версия | Использование | Лицензия | Тексты |
|---|---|---|---|---|
| annotated-types | 0.8.0 | runtime | MIT | [LICENSE](backend/third_party_licenses/annotated-types/0.8.0/licenses/LICENSE) |
| anyio | 4.15.1 | runtime | MIT | [LICENSE](backend/third_party_licenses/anyio/4.15.1/licenses/LICENSE) |
| certifi | 2026.10.23 | dev/tests | MPL-2.0 | [LICENSE](backend/third_party_licenses/certifi/2026.10.23/licenses/LICENSE) |
| click | 8.5.0 | runtime | BSD-3-Clause | [LICENSE.txt](backend/third_party_licenses/click/8.5.0/licenses/LICENSE.txt) |
| colorama | 0.4.6 | dev/tests | BSD-3-Clause | [LICENSE.txt](backend/third_party_licenses/colorama/0.4.6/licenses/LICENSE.txt) |
| fastapi | 0.115.6 | runtime | MIT | [LICENSE](backend/third_party_licenses/fastapi/0.115.6/licenses/LICENSE) |
| greenlet | 3.5.6 | runtime | MIT AND PSF-2.0 | [LICENSE](backend/third_party_licenses/greenlet/3.5.6/licenses/LICENSE), [LICENSE.PSF](backend/third_party_licenses/greenlet/3.5.6/licenses/LICENSE.PSF) |
| h11 | 0.16.0 | runtime | MIT | [LICENSE.txt](backend/third_party_licenses/h11/0.16.0/licenses/LICENSE.txt) |
| httpcore | 1.0.9 | dev/tests | BSD-3-Clause | [LICENSE.md](backend/third_party_licenses/httpcore/1.0.9/licenses/LICENSE.md) |
| httpx | 0.28.1 | dev/tests | BSD-3-Clause | [LICENSE.md](backend/third_party_licenses/httpx/0.28.1/licenses/LICENSE.md) |
| idna | 3.20 | runtime | BSD-3-Clause | [LICENSE.md](backend/third_party_licenses/idna/3.20/licenses/LICENSE.md) |
| iniconfig | 2.3.1 | dev/tests | MIT | [LICENSE](backend/third_party_licenses/iniconfig/2.3.1/licenses/LICENSE) |
| packaging | 26.3 | dev/tests | Apache-2.0 OR BSD-2-Clause | [LICENSE](backend/third_party_licenses/packaging/26.3/licenses/LICENSE), [LICENSE.APACHE](backend/third_party_licenses/packaging/26.3/licenses/LICENSE.APACHE), [LICENSE.BSD](backend/third_party_licenses/packaging/26.3/licenses/LICENSE.BSD) |
| pluggy | 1.7.0 | dev/tests | MIT | [LICENSE](backend/third_party_licenses/pluggy/1.7.0/licenses/LICENSE) |
| pydantic | 2.10.4 | runtime | MIT | [LICENSE](backend/third_party_licenses/pydantic/2.10.4/licenses/LICENSE) |
| pydantic_core | 2.27.2 | runtime | MIT | [LICENSE](backend/third_party_licenses/pydantic-core/2.27.2/licenses/LICENSE) |
| pydantic-settings | 2.7.0 | runtime | MIT | [LICENSE](backend/third_party_licenses/pydantic-settings/2.7.0/licenses/LICENSE) |
| pytest | 8.3.4 | dev/tests | MIT | [LICENSE](backend/third_party_licenses/pytest/8.3.4/LICENSE) |
| python-dotenv | 1.2.4 | runtime | BSD-3-Clause | [LICENSE](backend/third_party_licenses/python-dotenv/1.2.4/licenses/LICENSE) |
| PyYAML | 6.0.2 | dev/tests | MIT | [LICENSE](backend/third_party_licenses/pyyaml/6.0.2/LICENSE) |
| ruff | 0.8.4 | dev/tests | MIT | [LICENSE](backend/third_party_licenses/ruff/0.8.4/licenses/LICENSE) |
| SQLAlchemy | 2.0.36 | runtime | MIT | [LICENSE](backend/third_party_licenses/sqlalchemy/2.0.36/LICENSE) |
| starlette | 0.41.3 | runtime | BSD-3-Clause | [LICENSE.md](backend/third_party_licenses/starlette/0.41.3/licenses/LICENSE.md) |
| typing_extensions | 4.16.0 | runtime | PSF-2.0 | [LICENSE](backend/third_party_licenses/typing-extensions/4.16.0/licenses/LICENSE) |
| uvicorn | 0.34.0 | runtime | BSD-3-Clause | [LICENSE.md](backend/third_party_licenses/uvicorn/0.34.0/licenses/LICENSE.md) |

## Прочие компоненты

- Python 3.12: PSF License и включённые upstream-уведомления официального образа Python.
- SQLite: public domain; используется через стандартный модуль sqlite3.
- Swagger UI 5.17.14: Apache-2.0. Локальные JS/CSS скопированы без изменений;
  [LICENSE](backend/app/static/swagger/LICENSE),
  [NOTICE](backend/app/static/swagger/NOTICE),
  [источник и SHA-256](backend/app/static/swagger/README.md).
- Системные библиотеки Debian и Python сохраняют upstream-уведомления и лицензии;
  их тексты доступны в официальном образе, в том числе /usr/share/doc.
- Docker Desktop и uv — инструменты разработки, в приложение не встраиваются.
- Nginx 1.30.6: BSD-2-Clause, используется только в отдельном интеграционном прокси.
  [Лицензия](backend/tests/fixtures/nginx-LICENSE),
  [версия, digest и источник](backend/tests/fixtures/README.md).

## Смоделированные интеграции

ЕГРЮЛ — локальный поиск компании; БКИ — синтетическая история и переключаемый сбой;
подписание — фиксированный код 1234; выдача — локальный переход статуса.
Связи с реестрами, бюро, банком, почтой, SMS и мессенджерами нет.
Все компании, показатели и материалы ленты синтетические. ML/LLM не используется.
ИНН могут случайно совпасть с реальными; это не сведения о реальных компаниях.
