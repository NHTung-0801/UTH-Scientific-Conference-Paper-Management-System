# backend/submission-service/src/utils/file_handler.py
import os

UPLOAD_DIR = "uploads"

# Đảm bảo thư mục upload luôn tồn tại khi chạy app
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

def get_file_path(filename: str) -> str:
    """Trả về đường dẫn tuyệt đối hoặc tương đối tới file"""
    return os.path.join(UPLOAD_DIR, filename)

def file_exists(filename: str) -> bool:
    """Kiểm tra file có tồn tại trên ổ cứng không"""
    path = get_file_path(filename)
    return os.path.exists(path)