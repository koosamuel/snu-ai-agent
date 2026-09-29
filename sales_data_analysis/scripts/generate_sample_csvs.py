"""샘플 판매 CSV를 uploads에 여러 개 생성한다. 실제 거래가 아니다."""

from __future__ import annotations

import csv
import random
import sys
from calendar import monthrange
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from config import Config

CATALOG = [
    ("의류", "상의", "코튼 셔츠", 39000),
    ("의류", "상의", "니트 스웨터", 59000),
    ("의류", "하의", "슬랙스", 49000),
    ("의류", "하의", "데님 팬츠", 45000),
    ("의류", "아우터", "트렌치코트", 129000),
    ("의류", "아우터", "패딩", 159000),
    ("잡화", "가방", "크로스백", 79000),
    ("잡화", "가방", "토트백", 89000),
    ("잡화", "신발", "스니커즈", 99000),
    ("잡화", "신발", "로퍼", 85000),
    ("잡화", "액세서리", "벨트", 29000),
    ("잡화", "액세서리", "머플러", 25000),
]
STORES = {
    "강남점": "오프라인",
    "홍대점": "오프라인",
    "부산점": "오프라인",
    "온라인몰": "온라인",
}
STORE_FILES = (
    ("gangnam", "강남점"),
    ("hongdae", "홍대점"),
    ("busan", "부산점"),
    ("online", "온라인몰"),
)


def _row(rng: random.Random, day: date, store: str | None = None) -> dict:
    category, subcategory, product_name, unit_price = rng.choice(CATALOG)
    chosen = store or rng.choice(list(STORES))
    return {
        "sale_date": day.isoformat(),
        "category": category,
        "subcategory": subcategory,
        "product_name": product_name,
        "quantity": rng.randint(1, 4),
        "unit_price": unit_price,
        "store": chosen,
        "channel": STORES[chosen],
    }


def _write(path: Path, rows: list[dict]) -> None:
    ordered = sorted(rows, key=lambda item: item["sale_date"])
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(Config.REQUIRED_COLUMNS))
        writer.writeheader()
        writer.writerows(ordered)


def generate(folder: Path | None = None, seed: int = 42) -> list[Path]:
    folder = folder or Config.UPLOAD_FOLDER
    folder.mkdir(parents=True, exist_ok=True)
    rng = random.Random(seed)
    created: list[Path] = []

    for month in range(1, 13):
        last_day = monthrange(2026, month)[1]
        rows = [
            _row(rng, date(2026, month, rng.randint(1, last_day)))
            for _ in range(60)
        ]
        path = folder / f"sales_2026_{month:02d}.csv"
        _write(path, rows)
        created.append(path)

    for slug, store in STORE_FILES:
        rows = [
            _row(rng, date(2025, rng.randint(7, 12), rng.randint(1, 28)), store)
            for _ in range(40)
        ]
        path = folder / f"sales_{slug}_2025.csv"
        _write(path, rows)
        created.append(path)

    return created


if __name__ == "__main__":
    paths = generate()
    print(f"{len(paths)} files")
    for path in paths:
        print(path.name)
