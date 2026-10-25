import argparse
import json
from decimal import Decimal
from pathlib import Path
from time import monotonic, sleep
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from uuid import uuid4


def check(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def request(base: str, path: str, method="GET", payload=None, headers=None):
    body = json.dumps(payload).encode() if payload is not None else None
    request_headers = {"Content-Type": "application/json", **(headers or {})}
    query = Request(base + path, data=body, method=method, headers=request_headers)
    try:
        with urlopen(query, timeout=3) as response:
            return response.status, json.load(response)
    except HTTPError as exc:
        return exc.code, json.loads(exc.read())


def wait_for(base: str, application_id: str, expected: str, timeout: float):
    deadline = monotonic() + timeout
    while monotonic() < deadline:
        status, detail = request(base, f"/applications/{application_id}")
        check(status == 200, f"GET заявки вернул {status}")
        if detail["status"] == expected:
            return detail
        sleep(0.1)
    raise RuntimeError(f"Не дождались {expected} за {timeout} секунд")


def check_decision(detail: dict, case: dict) -> None:
    expected = case["expected"]
    decision = detail["decision"]
    check(detail["decision"]["score"] == expected["score"], "Не совпал score")
    check(decision["outcome"] == expected["status"], "Не совпало решение")
    for field in ("amount", "monthly_payment", "overpayment"):
        check(
            decision["approved_amount" if field == "amount" else field] == expected[field],
            f"Не совпало поле {field}",
        )
    if expected["rate"] is not None:
        check(Decimal(decision["rate"]) == Decimal(expected["rate"]), "Не совпала ставка")
    else:
        check(
            detail["decision"]["rejection_reason"] == expected["rejection_reason"],
            "Не совпала причина отказа",
        )


def run_case(base: str, case: dict, timeout: float) -> dict:
    payload = {key: case["input"][key] for key in ("requested_amount", "term_months", "goal")}
    _, payload["company"] = request(base, "/companies/lookup?inn=" + case["inn"])
    headers = {"Idempotency-Key": f"smoke-{uuid4()}"}
    status, created = request(base, "/applications", "POST", payload, headers)
    check(
        status == 201 and created["status"] == "SUBMITTED", "Создание должно вернуть 201/SUBMITTED"
    )
    application_id = created["id"]
    status, duplicate = request(base, "/applications", "POST", payload, headers)
    check(status == 200 and duplicate["id"] == application_id, "Не работает идемпотентность")
    detail = wait_for(base, application_id, case["expected"]["status"], timeout)
    check_decision(detail, case)
    path = f"/applications/{application_id}"
    if detail["status"] == "REJECTED":
        status, _ = request(base, path + "/sign", "POST", {"code": "1234"})
        check(status == 409, "Отказ не должен подписываться")
        final_status = "REJECTED"
    else:
        if detail["status"] == "COUNTER_OFFER":
            status, _ = request(base, path + "/sign", "POST", {"code": "1234"})
            check(status == 409, "Встречное предложение требует принятия")
            status, accepted = request(base, path + "/accept-offer", "POST")
            check(
                status == 200 and accepted["status"] == "OFFER_ACCEPTED", "Предложение не принято"
            )
        status, _ = request(base, path + "/sign", "POST", {"code": "0000"})
        check(status == 400, "Неверный код должен дать 400")
        status, signed = request(base, path + "/sign", "POST", {"code": "1234"})
        check(status == 200 and signed["status"] == "SIGNED", "Заявка не подписана")
        final_status = "DISBURSED"
        check_decision(wait_for(base, application_id, final_status, timeout), case)
    print(f"OK: {case['id']} -> {final_status}")
    return {"case_id": case["id"], "id": application_id, "status": final_status}


def main() -> None:
    parser = argparse.ArgumentParser(description="Три синтетических сценария через обычный HTTP")
    parser.add_argument("--base-url", default="http://127.0.0.1:8000/api")
    parser.add_argument("--timeout", type=float, default=20)
    parser.add_argument(
        "--reset", action="store_true", help="Перед проверкой удалить все демо-заявки"
    )
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--report", type=Path, help="Сохранить ID для проверки после перезапуска")
    group.add_argument("--verify-report", type=Path, help="Только проверить сохранённые ID и числа")
    args = parser.parse_args()
    if args.timeout <= 0 or (args.reset and args.verify_report):
        parser.error("timeout должен быть положительным; reset нельзя сочетать с verify-report")
    base = args.base_url.rstrip("/")
    cases_path = Path(__file__).resolve().parents[2] / "docs" / "scoring_cases.json"
    cases = json.loads(cases_path.read_text(encoding="utf-8"))["profiles"][:3]
    status, health = request(base, "/health")
    check(status == 200 and health["status"] == "ok", "Healthcheck не прошёл")
    if args.verify_report:
        report = json.loads(args.verify_report.read_text(encoding="utf-8"))
        check(len(report["applications"]) == 3, "В отчёте должны быть три заявки")
        by_id = {case["id"]: case for case in cases}
        for saved in report["applications"]:
            detail = wait_for(base, saved["id"], saved["status"], args.timeout)
            check_decision(detail, by_id[saved["case_id"]])
        print("OK: три заявки и результаты сохранились после перезапуска")
        return
    if args.reset:
        status, _ = request(base, "/demo/reset", "POST")
        check(status == 200, "Сброс демо не выполнен")
    results = [run_case(base, case, args.timeout) for case in cases]
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(
            json.dumps({"applications": results}, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
            newline="\n",
        )
        print(f"Отчёт: {args.report}")


if __name__ == "__main__":
    main()
