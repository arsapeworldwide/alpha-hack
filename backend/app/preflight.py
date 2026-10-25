import argparse
import json
from urllib.request import Request, urlopen


def main():
    parser = argparse.ArgumentParser(description="Проверка демо перед показом")
    parser.add_argument("--base-url", default="http://127.0.0.1:8000/api")
    args = parser.parse_args()
    base = args.base_url.rstrip("/")

    def request(path, payload=None, token=None):
        data = json.dumps(payload).encode() if payload is not None else None
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = "Bearer " + token
        with urlopen(Request(base + path, data=data, headers=headers), timeout=20) as response:
            return json.load(response)

    health = request("/health")
    if health.get("status") != "ok" or health.get("database") != "ok":
        raise RuntimeError("Сервис или БД не готовы")
    auth = request("/auth/login", {"login": "director", "password": "demo-credit-2026"})
    token = auth["access_token"]
    try:
        mode = request("/demo/failures", token=token)
        if mode["bki"] != "ok":
            raise RuntimeError("БКИ отключено: нажмите «Восстановить БКИ» перед показом")
        if len(request("/demo-profiles")) != 3:
            raise RuntimeError("Не найдены три эталонных демо-профиля")
        if not request("/products"):
            raise RuntimeError("Каталог продуктов пуст")
        print("OK: API, database, login, BKI, profiles and products are ready")
    finally:
        request("/auth/logout", {}, token)


if __name__ == "__main__":
    main()
