from pathlib import Path


class Config:
    BASE_DIR = Path(__file__).resolve().parent
    UPLOAD_FOLDER = BASE_DIR / "uploads"
    DATA_FILENAME = "sales_data.csv"
    SECRET_KEY = "dev-sales-dashboard"
    MAX_CONTENT_LENGTH = 8 * 1024 * 1024
    HOST = "127.0.0.1"
    PORT = 8082

    REQUIRED_COLUMNS = (
        "sale_date",
        "category",
        "subcategory",
        "product_name",
        "quantity",
        "unit_price",
        "store",
        "channel",
    )

    @classmethod
    def data_path(cls) -> Path:
        return cls.UPLOAD_FOLDER / cls.DATA_FILENAME

    @classmethod
    def csv_paths(cls) -> list[Path]:
        return sorted(cls.UPLOAD_FOLDER.glob("*.csv"))
