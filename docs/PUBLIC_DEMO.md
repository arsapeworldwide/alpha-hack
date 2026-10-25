# Публичная демонстрация

Полный проект опубликован в main: https://github.com/arsapeworldwide/alpha-hack.
GitHub хранит исходники; приложение запускается отдельно. GitHub Pages не запускает FastAPI и SQLite.

Для временного показа с этого ПК используется отдельный контейнер Cloudflare Tunnel.
Он направляет HTTPS-запросы на frontend:8080; приложение и симуляторы остаются локальными.
Регистрация, домен и открытие портов роутера не нужны.

Сначала `docker compose up --build --wait`, затем из PowerShell:

```powershell
docker run -d --name alfa-hack-public-preview --restart unless-stopped cloudflare/cloudflared@sha256:faa8e0a1475f137c910be6025f43c8e4092fdd35461b31e19fd1390657a1ff39 tunnel --no-autoupdate --protocol http2 --url http://host.docker.internal:8080
docker logs alfa-hack-public-preview
```

Контейнер уже создан на рабочем ПК. Повторный `docker run` с тем же именем не нужен.
Найдите в логах адрес `https://….trycloudflare.com` и отправьте его посетителям.
После остановки/перезапуска туннеля адрес может измениться. Остановить публикацию:

```powershell
docker stop alfa-hack-public-preview
```

Повторно запустить: `docker start alfa-hack-public-preview`, затем снова посмотреть логи.
Туннель отдельный от compose; `docker compose down` сам туннель не останавливает.
ПК, интернет, Docker и оба сервиса должны работать. Гарантий доступности нет.
Все посетители работают с общей синтетической БД, общий сброс удаляет демо-заявки.
Это публичное демо с демонстрационным банковским токеном, а не среда для настоящих данных.

Для постоянного адреса нужен отдельный сервер с Docker, постоянным диском,
доменом/HTTPS и изменённым BANK_API_TOKEN. Тогда сайт не зависит от этого ПК.
Аккаунт, сервер и домен пока не предоставлены; платные ресурсы не создавались.
Инструкция запуска приложения остаётся той же, TLS завершается внешним reverse proxy.

Источник: [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).
cloudflared 2026.10.3 распространяется под Apache-2.0; это отдельный инструмент
публикации, в runtime-образ бэкенда не включён.
