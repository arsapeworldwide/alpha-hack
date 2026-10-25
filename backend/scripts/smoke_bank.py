import argparse
import json
import os
from decimal import Decimal
from pathlib import Path

from scripts.smoke_api import authenticate, check, request, wait_for


def review(base: str, application_id: str, action: str, headers: dict):
    return request(
        base,
        f"/bank/applications/{application_id}/decision",
        "POST",
        {"action": action, "comment": "Синтетическое ручное рассмотрение"},
        headers,
    )


def create(base: str, inn: str, expected: str, timeout: float):
    _, company = request(base, "/companies/lookup?inn=" + inn)
    status, created = request(
        base,
        "/applications",
        "POST",
        {
            "company": company,
            "requested_amount": 10_000_000,
            "term_months": 36,
            "goal": "working_capital",
            "consent": True,
        },
    )
    check(status == 201 and created["status"] == "SUBMITTED", "Создание не вернуло 201/SUBMITTED")
    return wait_for(base, created["id"], expected, timeout)


def verify(base: str, saved: dict, timeout: float) -> None:
    approved = wait_for(base, saved["approved_id"], "DISBURSED", timeout)
    rejected = wait_for(base, saved["rejected_id"], "REJECTED", timeout)
    check(
        approved["decision"]["score"] == 46 and (approved["decision"]["decided_by"] == "bank"),
        "Ручное одобрение потеряно",
    )
    check(approved["decision"]["approved_amount"] == 10_000_000, "Ручная сумма потеряна")
    check(Decimal(approved["decision"]["rate"]) == 24, "Ручная ставка потеряна")
    check(
        approved["decision"]["monthly_payment"] == 392_329
        and approved["decision"]["overpayment"] == 4_123_844,
        "Ручные платежи потеряны",
    )
    check(
        (rejected["decision"]["decided_by"] == "bank")
        and rejected["decision"]["approved_amount"] is None,
        "Ручной отказ потерян",
    )
    for detail in (approved, rejected):
        check(
            any(e["actor"] == "bank" and e["details"].get("comment") for e in detail["events"]),
            "Банковский аудит потерян",
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Банковская роль через реальный HTTP")
    parser.add_argument("--base-url", default="http://127.0.0.1:8000/api")
    parser.add_argument("--timeout", type=float, default=20)
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--report", type=Path)
    group.add_argument("--verify-report", type=Path)
    args = parser.parse_args()
    if args.timeout <= 0:
        parser.error("timeout должен быть положительным")
    base = args.base_url.rstrip("/")
    authenticate(base)
    headers = {"X-Bank-Token": os.environ.get("BANK_API_TOKEN", "demo-bank-token")}
    status, _ = request(base, "/bank/applications")
    check(status == 403, "Клиент получил доступ к банковской очереди")
    status, _ = request(base, "/bank/applications", headers=headers)
    check(status == 200, "Токен не подошёл; задайте BANK_API_TOKEN в окружении скрипта")
    if args.verify_report:
        verify(base, json.loads(args.verify_report.read_text(encoding="utf-8")), args.timeout)
        print("OK: ручные решения и аудит сохранились после перезапуска")
        return
    counter = create(base, "500100732259", "COUNTER_OFFER", args.timeout)
    status, approved = review(base, counter["id"], "approve", headers)
    check(status == 200 and approved["status"] == "APPROVED", "Ручное одобрение не выполнено")
    check(
        approved["decision"]["score"] == 46
        and approved["decision"]["factors"] == counter["decision"]["factors"],
        "Ручное решение изменило исходный скоринг",
    )
    check(
        approved["decision"]["approved_amount"] == 10_000_000
        and Decimal(approved["decision"]["rate"]) == 24,
        "Неверные ручные условия",
    )
    check(
        approved["decision"]["monthly_payment"] == 392_329
        and approved["decision"]["overpayment"] == 4_123_844,
        "Неверный ручной расчёт",
    )
    status, _ = request(base, f"/applications/{counter['id']}/sign", "POST", {"code": "1234"})
    check(status == 200, "Ручное одобрение не подписывается")
    wait_for(base, counter["id"], "DISBURSED", args.timeout)
    status, _ = review(base, counter["id"], "reject", headers)
    check(status == 409, "Банк изменил выданную заявку")
    retail = create(base, "7712345678", "APPROVED", args.timeout)
    status, rejected = review(base, retail["id"], "reject", headers)
    check(status == 200 and rejected["status"] == "REJECTED", "Ручной отказ не выполнен")
    poor = create(base, "7723456789", "REJECTED", args.timeout)
    status, error = review(base, poor["id"], "approve", headers)
    check(status == 409 and error["code"] == "INVALID_TRANSITION", "Нарушена граница SPEC")
    saved = {"approved_id": counter["id"], "rejected_id": retail["id"]}
    verify(base, saved, args.timeout)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(saved, indent=2) + "\n", encoding="utf-8", newline="\n")
    print("OK: bank auth, approve/reject, audit, signing and SPEC boundary")


if __name__ == "__main__":
    main()
