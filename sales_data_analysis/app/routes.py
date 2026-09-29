from pathlib import Path

from flask import Blueprint, flash, redirect, render_template, request, url_for
from werkzeug.utils import secure_filename

from app.analysis import build_dashboard
from config import Config

bp = Blueprint("dashboard", __name__)


def _allowed_csv(filename: str) -> bool:
    return Path(filename).suffix.lower() == ".csv"


@bp.get("/")
def index():
    payload = build_dashboard(Config.UPLOAD_FOLDER)
    return render_template("index.html", payload=payload)


@bp.post("/upload")
def upload():
    try:
        file = request.files["file"]
    except KeyError:
        flash("업로드 파일이 없습니다.", "error")
        return redirect(url_for("dashboard.index"))

    if not file or not file.filename:
        flash("CSV 파일을 선택해 주세요.", "error")
        return redirect(url_for("dashboard.index"))

    if not _allowed_csv(file.filename):
        flash("CSV 파일만 업로드할 수 있습니다.", "error")
        return redirect(url_for("dashboard.index"))

    filename = secure_filename(file.filename) or Config.DATA_FILENAME
    if Path(filename).suffix.lower() != ".csv":
        filename = Config.DATA_FILENAME

    target = Config.UPLOAD_FOLDER / filename
    file.save(target)
    flash(f"{filename}을(를) 저장했습니다. uploads의 CSV를 모두 합쳐 집계합니다.", "ok")
    return redirect(url_for("dashboard.index"))
