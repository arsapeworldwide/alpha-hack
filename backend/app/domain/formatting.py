from decimal import ROUND_HALF_UP, Decimal


def percent(value: Decimal, places: int = 2) -> str:
    quantum = Decimal(1).scaleb(-places)
    text = format(value.quantize(quantum, rounding=ROUND_HALF_UP), "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return text.replace(".", ",") + "%"


def rubles(value: int) -> str:
    return f"{value:,}".replace(",", " ") + " ₽"


def years(value: int) -> str:
    remainder = value % 100
    ending = (
        "лет"
        if 11 <= remainder <= 14
        else ("год" if value % 10 == 1 else "года" if value % 10 in (2, 3, 4) else "лет")
    )
    return f"{value} {ending}"
