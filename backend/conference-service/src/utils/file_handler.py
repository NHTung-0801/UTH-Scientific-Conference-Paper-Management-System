# backend/conference-service/src/utils/file_handler.py
import os
import shutil
from pathlib import Path
from uuid import uuid4
from typing import Optional
from fastapi import UploadFile

# BASE_DIR là thư mục src
BASE_DIR = Path(__file__).resolve().parents[1]
STATIC_DIR = BASE_DIR / "static"

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}

def save_image(file: UploadFile, subfolder: str) -> Optional[str]:
    """
    Lưu file upload vào thư mục src/static/<subfolder>/ với tên file UUID ngẫu nhiên.
    Trả về đường dẫn URL chuẩn: '/static/<subfolder>/<uuid>.<ext>'
    """
    if not file or not file.filename:
        return None

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        ext = ".png"  # fallback an toàn

    target_dir = STATIC_DIR / subfolder
    target_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid4().hex}{ext}"
    file_path = target_dir / filename

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    finally:
        file.file.close()

    return f"/static/{subfolder}/{filename}"

def delete_image(relative_url: Optional[str]) -> bool:
    """
    Xóa file vật lý trên đĩa dựa trên đường dẫn URL lưu trong DB.
    Ví dụ: '/static/conference_logos/abc.jpg' hoặc 'topic_pictures/xyz.png'
    """
    if not relative_url:
        return False

    clean_path = relative_url.strip().lstrip("/")
    # Bỏ tiền tố static/ nếu có
    if clean_path.startswith("static/"):
        clean_path = clean_path[len("static/"):]

    file_path = STATIC_DIR / clean_path

    try:
        if file_path.is_file():
            file_path.unlink()
            return True
    except Exception as e:
        print(f"[FileHandler] Lỗi xóa file {file_path}: {e}")
    return False
