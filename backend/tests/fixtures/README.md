# Тестовый nginx

Конфигурация nginx.conf используется только docker-compose.integration.yml.
Она проксирует /api в сервис backend и не подменяет отсутствующий фронтенд.
Основной docker-compose.yml не запускает тестовый прокси.

Образ: официальный docker.io/library/nginx, версия nginx 1.30.6 (stable-alpine).
Зафиксирован manifest digest:
`sha256:47928bf67eb62a1863cb08d9ecb52d3e704304ba614eaee17884204677702951`.
Процесс работает как 101:101, rootfs только для чтения, временные файлы — /tmp.

Лицензия nginx — BSD-2-Clause. Полный текст nginx-LICENSE скопирован из
https://raw.githubusercontent.com/nginx/nginx/release-1.30.6/LICENSE.
Системные пакеты Alpine сохраняют лицензии в исходном официальном образе.
