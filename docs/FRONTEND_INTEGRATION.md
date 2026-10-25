# Интеграция фронтенда с бэкендом

В текущей рабочей копии frontend/ отсутствует. Корневой compose запускает бэкенд,
рядом оставлен комментарий для будущего сервиса frontend. Код фронтенда не создавался
и не изменялся. Проверить клики в интерфейсе сейчас невозможно.

При добавлении frontend оба сервиса должны оставаться в одной compose-сети.
Зависимость от бэкенда желательно описать с condition: service_healthy.
Nginx внутри контейнера обращается по имени сервиса backend и внутреннему порту 8000,
браузер — по относительному URL /api. Имя backend не разрешается в браузере пользователя.

Пример фрагмента nginx для фронтенд-разработчика:

```nginx
location /api/ {
    proxy_pass http://backend:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Request-ID $request_id;
    proxy_connect_timeout 3s;
    proxy_read_timeout 15s;
    # В стандартный access-log попал бы query string с ИНН.
    access_log off;
}
```

У proxy_pass нет завершающего `/`: так /api/applications доходит до FastAPI
под тем же путём. POST /applications возвращает SUBMITTED; результат необходимо
получать опросом GET /applications/{id}. Стандартная пауза каждого этапа — 1 секунда.
При NEEDS_RECHECK показывать message; это не финансовый отказ.

CORS разрешает http://localhost:5173 и http://localhost:8080.
При проксировании через nginx браузер работает с одним origin.
X-Request-ID открыт для чтения через CORS. Путь /api/docs и его локальные ресурсы
также должны проходить через этот location.

Схемы: [API_CONTRACT.md](API_CONTRACT.md) и [openapi.yaml](openapi.yaml).
Деньги — целые рубли; ставка и баллы — десятичные строки.

## Проверка nginx без фронтенда

Для проверки маршрутов доступен отдельный тестовый прокси, frontend/ он не создаёт.
Из корня репозитория:

```sh
docker compose -f docker-compose.yml -f docker-compose.integration.yml --profile integration up --wait
```

Проверка: http://localhost:18080/api/health, Swagger: http://localhost:18080/api/docs.
Порт меняется через INTEGRATION_PROXY_PORT. Образ официального nginx 1.30.6
зафиксирован по digest; первичная загрузка требует интернета.
Основной запуск `docker compose up --build` включает только backend.

Из backend/ можно прогнать оба HTTP-сценария через прокси:

```sh
python -m scripts.smoke_api --base-url http://localhost:18080/api
python -m scripts.smoke_bank --base-url http://localhost:18080/api
```

Для своего BANK_API_TOKEN задайте его в окружении банковского скрипта.
Завершить и удалить только тестовый прокси, сохранив backend и БД:

```sh
docker compose -f docker-compose.yml -f docker-compose.integration.yml --profile integration stop integration_proxy
docker compose -f docker-compose.yml -f docker-compose.integration.yml --profile integration rm -f integration_proxy
```

Фактическая интеграция будущего фронтенда всё равно требует проверки его nginx,
форм и обработки состояний. Тестовый прокси проверяет работу опубликованного API.

## Что передать фронтенд-разработчику

- openapi.yaml — полная схема 12 операций; пока помечена черновиком бэкенда.
- API_CONTRACT.md и CONTRACT_CHANGES.md — поля, ошибки и согласованные допущения.
- scoring_cases.json — общие эталонные числа для моков.
- APPLICATION_STATES.md — переходы и условия подписания.
- api_collection/backend.http — готовые запросы, включая банковскую роль.

Создание заявки возвращает SUBMITTED: экран опрашивает GET по ID, например раз в секунду.
APPROVED можно подписать сразу; COUNTER_OFFER сначала принимается, REJECTED не подписывается.
После SIGNED нужно дождаться DISBURSED. NEEDS_RECHECK показывает message без причины отказа.
Ошибки читаются как {code, message, details}; 409 требует обновить состояние заявки,
429 означает исчерпание пяти неверных попыток подписи.
Банковское решение с manual=true сохраняет исходный score и факторы; комментарий виден клиенту.
Для банковского демо токен вводит тестировщик: не помещать свой BANK_API_TOKEN в публичную сборку.

Для завершения общей проверки нужны исходники frontend/ с package.json, инструкцией
сборки и реальным nginx-конфигом либо репозиторий/ветка, откуда их можно взять.
Если у фронтенда уже есть свой контракт, он должен быть предоставлен для сверки;
при расхождениях изменения фиксируются до интеграции.

Архив исходников для передачи можно создать после коммита, из корня:
`git archive --format=zip --output=backend-handoff.zip HEAD`.
Он содержит зафиксированные исходники, схему, лицензии и документацию;
локальные `.env`, БД, `.venv` и служебные загрузки в него не входят.
