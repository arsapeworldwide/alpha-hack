import re
from importlib.metadata import distribution
from pathlib import Path
from shutil import copyfile

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"


def normalized(name: str) -> str:
    return re.sub(r"[-_.]+", "-", name).lower()


def locked_packages(path: Path) -> dict[str, str]:
    return {
        normalized(name): version
        for name, version in re.findall(
            r"^([\w.-]+)==([^\s;\\]+)", path.read_text(encoding="utf-8"), re.MULTILINE
        )
    }


def copy_licenses(dist, destination: Path) -> list[Path]:
    copied = []
    for file in dist.files or []:
        parts = file.parts
        index = next((i for i, part in enumerate(parts) if part.endswith(".dist-info")), None)
        if index is None:
            continue
        relative = Path(*parts[index + 1 :])
        if not any(
            word in relative.as_posix().lower() for word in ("license", "copying", "notice")
        ):
            continue
        target = destination / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        copyfile(dist.locate_file(file), target)
        copied.append(target)
    if not copied:
        raise RuntimeError(f"Нет текста лицензии в wheel {dist.metadata['Name']}")
    return copied


def license_name(dist, files: list[Path]) -> str:
    expression = dist.metadata.get("License-Expression")
    if expression:
        return expression
    classifiers = dist.metadata.get_all("Classifier", [])
    labels = [c.split(" :: ")[-1] for c in classifiers if c.startswith("License ::")]
    label = next((value for value in labels if value != "OSI Approved"), "")
    if label == "BSD License":
        text = "\n".join(p.read_text(encoding="utf-8", errors="replace") for p in files).lower()
        return "BSD-3-Clause" if "neither" in text else "BSD-2-Clause"
    return {"MIT License": "MIT", "Mozilla Public License 2.0 (MPL 2.0)": "MPL-2.0"}.get(
        label,
        label or dist.metadata.get("License", "UNKNOWN").splitlines()[0],
    )


def main() -> None:
    runtime = locked_packages(BACKEND / "requirements.txt")
    development = locked_packages(BACKEND / "requirements-dev.txt")
    lines = [
        "# Сторонние компоненты и симуляторы",
        "",
        "Список экспортирован из зафиксированных requirements и metadata установленных wheels.",
        "Полные оригинальные тексты лицензий скопированы в backend/third_party_licenses/.",
        "Обновление из backend/: python -m scripts.export_notices (после установки dev-lock).",
        "",
        "| Компонент | Версия | Использование | Лицензия | Тексты |",
        "|---|---|---|---|---|",
    ]
    for name, version in sorted(development.items()):
        dist = distribution(name)
        if dist.version != version:
            raise RuntimeError(f"Установленная версия {name} не совпадает с lock")
        destination = BACKEND / "third_party_licenses" / name / version
        files = copy_licenses(dist, destination)
        license_label = license_name(dist, files)
        if license_label == "UNKNOWN":
            raise RuntimeError(f"Не определена лицензия {name}")
        links = ", ".join(f"[{p.name}]({p.relative_to(ROOT).as_posix()})" for p in files)
        usage = "runtime" if name in runtime else "dev/tests"
        lines.append(
            f"| {dist.metadata['Name']} | {version} | {usage} | {license_label} | {links} |"
        )
    lines += [
        "",
        "## Прочие компоненты",
        "",
        "- Python 3.12: PSF License и включённые upstream-уведомления официального образа Python.",
        "- SQLite: public domain; используется через стандартный модуль sqlite3.",
        "- Swagger UI 5.17.14: Apache-2.0. Локальные JS/CSS скопированы без изменений;",
        "  [LICENSE](backend/app/static/swagger/LICENSE),",
        "  [NOTICE](backend/app/static/swagger/NOTICE),",
        "  [источник и SHA-256](backend/app/static/swagger/README.md).",
        "- Системные библиотеки Debian и Python сохраняют upstream-уведомления и лицензии;",
        "  их тексты доступны в официальном образе, в том числе /usr/share/doc.",
        "- Docker Desktop и uv — инструменты разработки, в приложение не встраиваются.",
        "- Nginx 1.30.6: BSD-2-Clause, используется только в отдельном интеграционном прокси.",
        "  [Лицензия](backend/tests/fixtures/nginx-LICENSE),",
        "  [версия, digest и источник](backend/tests/fixtures/README.md).",
        "",
        "## Смоделированные интеграции",
        "",
        "ЕГРЮЛ — локальный поиск компании; БКИ — синтетическая история и переключаемый сбой;",
        "подписание — фиксированный код 1234; выдача — локальный переход статуса.",
        "Связи с реестрами, бюро, банком, почтой, SMS и мессенджерами нет.",
        "Все компании, показатели и материалы ленты синтетические. ML/LLM не используется.",
        "ИНН могут случайно совпасть с реальными; это не сведения о реальных компаниях.",
    ]
    (ROOT / "THIRD_PARTY_NOTICES.md").write_text(
        "\n".join(lines) + "\n", encoding="utf-8", newline="\n"
    )
    print(f"Exported notices and license texts for {len(development)} packages")


if __name__ == "__main__":
    main()
