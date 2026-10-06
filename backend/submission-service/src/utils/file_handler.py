import os
import shutil
from uuid import uuid4
from fastapi import UploadFile, HTTPException
from src.config import settings

# Lấy cấu hình từ config.py
BASE_UPLOAD_DIR = settings.UPLOAD_DIR
PAPERS_DIR = os.path.join(BASE_UPLOAD_DIR, "papers")

ALLOWED_EXTENSIONS = {".pdf"}
ALLOWED_CONTENT_TYPES = {"application/pdf"}

UPLOAD_DIR = "uploads"

# Đảm bảo thư mục gốc tồn tại khi chạy
os.makedirs(PAPERS_DIR, exist_ok=True)

def ensure_dir(path: str) -> None:
    """Tạo thư mục nếu chưa tồn tại"""
    os.makedirs(path, exist_ok=True)

def get_file_extension(filename: str) -> str:
    return os.path.splitext(filename)[1].lower()

def validate_file(upload_file: UploadFile) -> None:
    # 1. Kiểm tra đuôi file
    filename = upload_file.filename or ""
    ext = get_file_extension(filename)
    
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400, 
            detail=f"Định dạng tệp không được hỗ trợ. Chỉ chấp nhận tệp có đuôi: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # 2. Kiểm tra Content-Type
    if upload_file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Content-Type không hợp lệ. Chỉ chấp nhận application/pdf"
        )
    
    # 3. Kiểm tra kích thước file và rỗng
    try:
        upload_file.file.seek(0, os.SEEK_END)
        file_size = upload_file.file.tell()
        upload_file.file.seek(0) # Reset con trỏ về đầu để đọc sau này

        if file_size == 0:
            raise HTTPException(
                status_code=400,
                detail="Tệp tải lên không được để rỗng (0 bytes)."
            )

        # Lấy giới hạn từ settings (config.py)
        limit_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
        
        if file_size > limit_bytes:
            raise HTTPException(
                status_code=400,
                detail=f"Dung lượng tệp vượt quá giới hạn cho phép ({settings.MAX_FILE_SIZE_MB}MB)."
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi kiểm tra dung lượng tệp: {str(e)}")

    # 4. Kiểm tra chữ ký file (Magic Bytes PDF: %PDF-)
    try:
        header = upload_file.file.read(5)
        upload_file.file.seek(0) # Reset con trỏ về đầu file

        if not header.startswith(b"%PDF-"):
            raise HTTPException(
                status_code=400,
                detail="Tệp tải lên không phải là định dạng PDF hợp lệ (Invalid PDF signature / Magic bytes)."
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi kiểm tra chữ ký tệp tin: {str(e)}")

def save_paper_file(
    paper_id: int, 
    version_number: int, 
    upload_file: UploadFile
) -> str:
    """
    Lưu file vào ổ cứng.
    Cấu trúc thư mục: uploads/papers/{paper_id}/v{version_number}/paper.pdf
    """
    validate_file(upload_file)

    # Tạo đường dẫn thư mục chứa phiên bản này
    version_dir = os.path.join(
        PAPERS_DIR, 
        str(paper_id), 
        f"v{version_number}"
    )
    ensure_dir(version_dir)

    # Đường dẫn file vật lý trên ổ cứng
    file_path = os.path.join(version_dir, "paper.pdf")

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(upload_file.file, buffer)
    except Exception as e:
        # Nếu lỗi thì dọn dẹp thư mục vừa tạo
        if os.path.exists(version_dir):
            shutil.rmtree(version_dir)
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    # Trả về đường dẫn tương đối để lưu vào Database
    # Format: papers/10/v1/paper.pdf
    db_path = f"papers/{paper_id}/v{version_number}/paper.pdf"
    
    return db_path

def delete_paper_version_file(
        paper_id: int, 
        version_number: int
) -> None:
    """Xóa thư mục phiên bản bài báo (dùng khi rollback hoặc xóa bài)"""
    version_dir = os.path.join(
        PAPERS_DIR, str(paper_id), 
        f"v{version_number}"
    )
    if os.path.exists(version_dir):
        try:
            shutil.rmtree(version_dir)
            print(f"Deleted directory: {version_dir}")
        except Exception as e:
            print(f"Failed to delete directory {version_dir}: {e}")

def get_file_path_local(relative_path: str) -> str:
    """
    Chuyển đổi đường dẫn lưu trong DB thành đường dẫn tuyệt đối trên server.
    Dùng cho API download/xem file.
    Input: papers/10/v1/paper.pdf
    Output: /app/uploads/papers/10/v1/paper.pdf
    """
    return os.path.join(BASE_UPLOAD_DIR, relative_path)

def save_proceedings_cover(conference_id: int, upload_file: UploadFile) -> str:
    ext = os.path.splitext(upload_file.filename or "")[1].lower()
    allowed_img_exts = {".png", ".jpg", ".jpeg", ".webp"}
    if ext not in allowed_img_exts:
        raise HTTPException(
            status_code=400,
            detail=f"Định dạng ảnh bìa không hợp lệ. Chỉ chấp nhận: {', '.join(allowed_img_exts)}"
        )

    # Kiểm tra dung lượng ảnh bìa (tối đa 5MB)
    try:
        upload_file.file.seek(0, os.SEEK_END)
        size = upload_file.file.tell()
        upload_file.file.seek(0)

        if size == 0:
            raise HTTPException(status_code=400, detail="Tệp ảnh bìa không được để rỗng (0 bytes).")
        if size > 5 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Dung lượng ảnh bìa vượt quá giới hạn 5MB.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi kiểm tra dung lượng ảnh bìa: {str(e)}")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    filename = f"proceedings_cover_conf_{conference_id}_{uuid4().hex}{ext}"
    rel_path = os.path.join("proceedings", filename)
    abs_path = os.path.join(UPLOAD_DIR, rel_path)

    os.makedirs(os.path.dirname(abs_path), exist_ok=True)

    with open(abs_path, "wb") as f:
        shutil.copyfileobj(upload_file.file, f)

    return f"/proceedings/{filename}"