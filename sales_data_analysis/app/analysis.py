from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pandas as pd

from config import Config


class SalesSchemaError(ValueError):
    """CSV 열이 필수 스키마와 다를 때 발생한다."""


def load_all_sales(folder: Path) -> pd.DataFrame:
    paths = sorted(folder.glob("*.csv"))
    if not paths:
        raise FileNotFoundError(folder)
    return pd.concat([load_sales(path) for path in paths], ignore_index=True)


def load_sales(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    missing = [col for col in Config.REQUIRED_COLUMNS if col not in df.columns]
    if missing:
        raise SalesSchemaError(f"필수 열이 없습니다: {', '.join(missing)}")

    parsed = df.loc[:, list(Config.REQUIRED_COLUMNS)].copy()
    parsed["sale_date"] = pd.to_datetime(parsed["sale_date"], errors="raise")
    parsed["quantity"] = pd.to_numeric(parsed["quantity"], errors="raise")
    parsed["unit_price"] = pd.to_numeric(parsed["unit_price"], errors="raise")
    parsed["sales_amount"] = parsed["quantity"] * parsed["unit_price"]
    parsed["category"] = parsed["category"].astype(str).str.strip()
    return parsed


def monthly_sales(df: pd.DataFrame) -> list[dict]:
    grouped = (
        df.assign(month=df["sale_date"].dt.to_period("M").astype(str))
        .groupby("month", as_index=False)["sales_amount"]
        .sum()
        .sort_values("month")
    )
    return grouped.to_dict(orient="records")


def category_sales(df: pd.DataFrame) -> list[dict]:
    grouped = (
        df.groupby("category", as_index=False)["sales_amount"]
        .sum()
        .sort_values("sales_amount", ascending=False)
    )
    return grouped.to_dict(orient="records")


def store_sales(df: pd.DataFrame) -> list[dict]:
    grouped = (
        df.groupby("store", as_index=False)["sales_amount"]
        .sum()
        .sort_values("sales_amount", ascending=False)
    )
    return grouped.to_dict(orient="records")


@dataclass(frozen=True)
class DashboardPayload:
    has_data: bool
    error: str | None
    kpis: dict
    monthly: list[dict]
    by_category: list[dict]
    by_store: list[dict]
    rows: list[dict]
    required_columns: tuple[str, ...]
    file_count: int


def empty_payload(error: str | None = None) -> DashboardPayload:
    return DashboardPayload(
        has_data=False,
        error=error,
        kpis={"total_sales": 0, "total_qty": 0, "order_count": 0, "avg_order": 0},
        monthly=[],
        by_category=[],
        by_store=[],
        rows=[],
        required_columns=Config.REQUIRED_COLUMNS,
        file_count=0,
    )


def build_dashboard(folder: Path) -> DashboardPayload:
    try:
        df = load_all_sales(folder)
    except FileNotFoundError:
        return empty_payload()
    except (SalesSchemaError, ValueError, pd.errors.ParserError) as exc:
        return empty_payload(str(exc))

    if df.empty:
        return empty_payload("CSV에 판매 행이 없습니다.")

    total_sales = float(df["sales_amount"].sum())
    total_qty = int(df["quantity"].sum())
    order_count = int(len(df))
    avg_order = total_sales / order_count if order_count else 0
    preview = df.sort_values("sale_date", ascending=False).head(20)
    preview = preview.assign(
        sale_date=preview["sale_date"].dt.strftime("%Y-%m-%d"),
        sales_amount=preview["sales_amount"].round(0).astype(int),
        unit_price=preview["unit_price"].round(0).astype(int),
    )

    return DashboardPayload(
        has_data=True,
        error=None,
        kpis={
            "total_sales": int(round(total_sales)),
            "total_qty": total_qty,
            "order_count": order_count,
            "avg_order": int(round(avg_order)),
        },
        monthly=monthly_sales(df),
        by_category=category_sales(df),
        by_store=store_sales(df),
        rows=preview.to_dict(orient="records"),
        required_columns=Config.REQUIRED_COLUMNS,
        file_count=len(list(folder.glob("*.csv"))),
    )
