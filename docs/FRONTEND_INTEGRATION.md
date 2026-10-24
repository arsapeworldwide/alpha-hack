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
