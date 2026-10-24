import json
from urllib.error import URLError
from urllib.request import urlopen


def main() -> None:
    try:
        with urlopen("http://127.0.0.1:8000/api/health", timeout=2) as response:
            if response.status == 200 and json.load(response).get("status") == "ok":
                return
    except (URLError, TimeoutError, ValueError):
        pass
    raise SystemExit(1)


if __name__ == "__main__":
    main()
