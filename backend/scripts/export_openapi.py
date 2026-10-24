from pathlib import Path

import yaml

from app.main import create_app


def main() -> None:
    target = Path(__file__).resolve().parents[2] / "docs" / "openapi.yaml"
    schema = create_app().openapi()
    header = "# ЧЕРНОВИК бэкенда, сверить с контрактом фронтенда\n"
    target.write_text(
        header + yaml.safe_dump(schema, allow_unicode=True, sort_keys=False),
        encoding="utf-8",
        newline="\n",
    )
    print(f"Exported {len(schema['paths'])} paths to {target}")


if __name__ == "__main__":
    main()
