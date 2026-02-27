from sqlalchemy.orm import Session, selectinload
import os
import httpx
from typing import List, Optional, Dict
from sqlalchemy import desc, delete
from datetime import datetime
from . import models, schemas, exceptions
import requests
from pypdf import PdfReader
from .config import settings
from sqlalchemy import func


# ====================================================
# 1. CREATE PAPER (Nộp bài)
# ====================================================
def create_paper(
    db: Session, 
    paper_data: schemas.PaperCreate, 
    submitter_id: int
) -> models.Paper:
    
    # Kiểm tra deadline bên Conference Service
    validate_submission_window(paper_data.conference_id)

    # Kiểm tra trùng lặp (Logic NV: Không cho nộp trùng bài đang active)
    existing_paper = db.query(models.Paper).filter(
        models.Paper.submitter_id == submitter_id,
        models.Paper.conference_id == paper_data.conference_id,
        models.Paper.title == paper_data.title,
        models.Paper.status.notin_([
            models.PaperStatus.WITHDRAWN, 
            models.PaperStatus.REJECTED
        ])
    ).first()

    if existing_paper:
        raise exceptions.BusinessRuleError(
            f"Duplicate submission: You already have an active paper titled '{paper_data.title}' in this conference."
        )

    # Tạo bài báo
    db_paper = models.Paper(
        title=paper_data.title,
        abstract=paper_data.abstract,
        keywords=paper_data.keywords,
        conference_id=paper_data.conference_id,
        track_id=paper_data.track_id,
        submitter_id=submitter_id,
        is_blind_mode=paper_data.is_blind_mode,
        status=models.PaperStatus.SUBMITTED,
        submitted_at=datetime.utcnow()
    )
    db.add(db_paper)
    db.flush() # Để lấy ID ngay

    # Lưu danh sách đồng tác giả
    if paper_data.authors:
        db_authors = [
            models.PaperAuthor(
                paper_id=db_paper.id,
                full_name=author.full_name,
                email=author.email,
                organization=author.organization,
                is_corresponding=author.is_corresponding,
                user_id=author.user_id
            )
            for author in paper_data.authors
        ]
        db.add_all(db_authors)

    # Lưu danh sách chủ đề (Topics)
    if paper_data.topics:
        db_topics = [
            models.PaperTopic(
                paper_id=db_paper.id,
                topic_id=t.topic_id
            )
            for t in paper_data.topics
        ]
        db.add_all(db_topics)

    return db_paper
    

# ====================================================
# 2. CREATE VERSION (Tạo version file mới)
# ====================================================
def create_new_paper_version(
    db: Session, 
    paper_id: int, 
    file_url: str,
    is_blind_mode: bool,
    is_camera_ready: bool = False
)-> models.PaperVersion:
    
    # Lấy version mới nhất để tính số tiếp theo
    latest = (
        db.query(models.PaperVersion)
        .filter(models.PaperVersion.paper_id == paper_id)
        .order_by(desc(models.PaperVersion.version_number))
        .with_for_update()
        .first()
    )
    version_number = 1 if not latest else latest.version_number + 1
    
    db_version = models.PaperVersion(
        paper_id=paper_id,
        version_number=version_number,
        file_url=file_url,
        is_camera_ready=is_camera_ready,
        is_anonymous=is_blind_mode
    )
    db.add(db_version)
    return db_version    


# ====================================================
# 3. GET PAPERS (Danh sách bài của Author)
# ====================================================
def get_papers_by_author(
    db: Session,
    submitter_id: int
) -> list[models.Paper]:
    return (
        db.query(models.Paper)
        .options(
            selectinload(models.Paper.authors),
            selectinload(models.Paper.topics),
            selectinload(models.Paper.versions)
        )
        .filter(models.Paper.submitter_id == submitter_id)
        .order_by(desc(models.Paper.submitted_at))
        .all()
    )


# ====================================================
# 4. GET DETAIL (Chi tiết bài của Author)
# ====================================================
def get_author_paper_detail(
    db: Session,
    paper_id: int,
    submitter_id: int
) -> models.Paper:
    
    paper = (
            db.query(models.Paper)
            .options(
                selectinload(models.Paper.authors),
                selectinload(models.Paper.topics),
                selectinload(models.Paper.versions)
            )
            .filter(models.Paper.id == paper_id)
            .first()
        )
    
    if not paper:
        raise exceptions.PaperNotFoundError(f"Paper with id {paper_id} not found")

    if paper.submitter_id != submitter_id:
        raise exceptions.NotAuthorizedError("You do not have permission to view this paper")

    return paper


# Helper check quyền sở hữu
def check_paper_ownership(db: Session, paper_id: int, submitter_id: int):
    paper = db.query(models.Paper).filter(models.Paper.id == paper_id).first()
    if not paper:
        raise exceptions.PaperNotFoundError(f"Paper {paper_id} not found")
    
    if paper.submitter_id != submitter_id:
        raise exceptions.NotAuthorizedError("You are not the owner of this paper")
    
    return paper


# ====================================================
# 5. MANAGE AUTHORS (Thêm/Sửa/Xóa tác giả)
# ====================================================
def add_author(db: Session, paper_id: int, submitter_id: int, author_data: schemas.AuthorAdd):
    paper = check_paper_ownership(db, paper_id, submitter_id)
    
    # 1. Chặn các trạng thái chết
    if paper.status in [models.PaperStatus.REJECTED, models.PaperStatus.WITHDRAWN]:
        raise exceptions.BusinessRuleError("Cannot add authors to a closed paper.")

    # 2. Chia nhánh kiểm tra
    if paper.status == models.PaperStatus.ACCEPTED:
        validate_camera_ready_window(paper.conference_id)
    elif paper.status == models.PaperStatus.REVISION_REQUIRED:
        pass
    else:
        validate_submission_window(paper.conference_id)

    # 3. Check duplicate
    exists = db.query(models.PaperAuthor).filter(
        models.PaperAuthor.paper_id == paper_id,
        models.PaperAuthor.email == author_data.email
    ).first()
    if exists:
        raise exceptions.BusinessRuleError(f"Author with email '{author_data.email}' already exists.")

    new_author = models.PaperAuthor(
        paper_id=paper_id,
        full_name=author_data.full_name,
        email=author_data.email,
        organization=author_data.organization,
        is_corresponding=author_data.is_corresponding,
        user_id=author_data.user_id
    )
    db.add(new_author)
    db.commit()
    db.refresh(new_author)
    return new_author

def remove_author(db: Session, paper_id: int, author_id: int, submitter_id: int):
    paper = check_paper_ownership(db, paper_id, submitter_id)

    if paper.status in [models.PaperStatus.REJECTED, models.PaperStatus.WITHDRAWN]:
        raise exceptions.BusinessRuleError("Cannot remove authors from a closed paper.")
    
    # Logic chia nhánh
    if paper.status == models.PaperStatus.ACCEPTED:
        validate_camera_ready_window(paper.conference_id)
    elif paper.status == models.PaperStatus.REVISION_REQUIRED:
        pass
    else:
        validate_submission_window(paper.conference_id)

    author = db.query(models.PaperAuthor).filter(
        models.PaperAuthor.id == author_id,
        models.PaperAuthor.paper_id == paper_id
    ).first()

    if not author:
        raise exceptions.AuthorNotFoundError(f"Author {author_id} not found")

    db.delete(author)
    db.commit()
    return True


def withdraw_paper(db: Session, paper_id: int, submitter_id: int) -> models.Paper:
    
    paper = db.query(models.Paper).filter(models.Paper.id == paper_id).first()
    
    if not paper:
        raise exceptions.PaperNotFoundError(f"Paper {paper_id} not found")
    
    if paper.submitter_id != submitter_id:
        raise exceptions.NotAuthorizedError("You are not the owner of this paper")

    validate_submission_window(paper.conference_id)

    if paper.status in [models.PaperStatus.ACCEPTED, models.PaperStatus.REJECTED]:
        raise exceptions.BusinessRuleError("Cannot withdraw a paper that has been Accepted or Rejected.")

    if paper.status == models.PaperStatus.WITHDRAWN:
        raise exceptions.BusinessRuleError("This paper is already withdrawn.")

    paper.status = models.PaperStatus.WITHDRAWN
    
    db.commit()
    db.refresh(paper)
    return paper


def update_paper_metadata(
    db: Session, 
    paper_id: int, 
    submitter_id: int, 
    update_data: schemas.PaperUpdate
) -> models.Paper:
    
    paper = check_paper_ownership(db, paper_id, submitter_id)

    if paper.status in [models.PaperStatus.REJECTED, models.PaperStatus.WITHDRAWN]:
            raise exceptions.BusinessRuleError("Cannot edit a closed paper.")

    if paper.status == models.PaperStatus.ACCEPTED:
        validate_camera_ready_window(paper.conference_id)
    elif paper.status == models.PaperStatus.REVISION_REQUIRED:
        pass
    else:
        validate_submission_window(paper.conference_id)
        

    if update_data.title is not None:
        if update_data.title != paper.title:
            exists = db.query(models.Paper).filter(
                models.Paper.submitter_id == submitter_id,
                models.Paper.conference_id == paper.conference_id,
                models.Paper.title == update_data.title,
                models.Paper.status.notin_([models.PaperStatus.WITHDRAWN, models.PaperStatus.REJECTED])
            ).first()
            if exists:
                raise exceptions.BusinessRuleError("Title already exists in another active submission.")
        
        paper.title = update_data.title

    if update_data.abstract is not None:
        paper.abstract = update_data.abstract
        
    if update_data.keywords is not None:
        paper.keywords = update_data.keywords

    if update_data.topics is not None:
        db.query(models.PaperTopic).filter(models.PaperTopic.paper_id == paper_id).delete()
        
        new_topics = [
            models.PaperTopic(paper_id=paper_id, topic_id=t.topic_id)
            for t in update_data.topics
        ]
        db.add_all(new_topics)

    db.commit()
    db.refresh(paper)
    return paper

def get_next_version_number(db: Session, paper_id: int) -> int:
    last_ver = (
        db.query(models.PaperVersion)
        .filter(models.PaperVersion.paper_id == paper_id)
        .order_by(desc(models.PaperVersion.version_number))
        .first()
    )
    return 1 if not last_ver else last_ver.version_number + 1

def upload_new_version(
    db: Session, 
    paper_id: int, 
    submitter_id: int, 
    file_path: str,
    version_number: int,
    is_blind_mode: bool
) -> models.PaperVersion:
    
    paper = check_paper_ownership(db, paper_id, submitter_id)

    if paper.status == models.PaperStatus.ACCEPTED:
        raise exceptions.BusinessRuleError("Please use 'Camera-Ready Submission' for accepted papers.")
        
    if paper.status in [models.PaperStatus.REJECTED, models.PaperStatus.WITHDRAWN]:
        raise exceptions.BusinessRuleError("Closed paper.")

    if paper.status != models.PaperStatus.REVISION_REQUIRED:
        validate_submission_window(paper.conference_id)
    
    # 2. Lưu record vào DB (Dùng version_number được truyền vào)
    new_version = models.PaperVersion(
        paper_id=paper_id,
        version_number=version_number, # Dùng số đã tính
        file_url=file_path,
        is_camera_ready=False,
        is_anonymous=is_blind_mode
    )
    db.add(new_version)

    # 3. Update Status bài báo
    if paper.status == models.PaperStatus.REVISION_REQUIRED:
        paper.status = models.PaperStatus.SUBMITTED
    paper.submitted_at = datetime.utcnow()

    db.commit()
    db.refresh(new_version)
    return new_version


# --- HÀM HELPER: KIỂM TRA DEADLINE ---
def validate_submission_window(conference_id: int):
    # Logic cũ của bạn (giữ nguyên, nhưng nhớ import requests nếu chưa có)
    try:
        base = (settings.CONFERENCE_SERVICE_URL or "").rstrip("/")
        url = f"{base}/api/conferences/{conference_id}"
        resp = requests.get(url, timeout=5)
        
        if resp.status_code != 200:
            # Fallback hoặc raise error tùy bạn, ở đây raise để an toàn
            raise Exception("Cannot connect to Conference Service")
            
        conf_info = resp.json() # Giả sử trả về dict khớp schema
        
        deadline_str = conf_info.get("submission_deadline")
        if deadline_str:
            # Parse deadline chuẩn
            deadline = _parse_deadline(deadline_str)
            if deadline and datetime.utcnow() > deadline.replace(tzinfo=None):
                 raise exceptions.DeadlineExceededError(f"Submission deadline passed.")
        return conf_info
    
    except requests.RequestException:
        raise Exception("Failed to validate conference deadline.")
    

def update_paper_decision(
    db: Session, 
    paper_id: int, 
    decision_data: schemas.PaperDecision
) -> models.Paper:
    
    paper = db.query(models.Paper).filter(models.Paper.id == paper_id).first()
    
    if not paper:
        raise exceptions.PaperNotFoundError(f"Paper {paper_id} not found")

    if paper.status == models.PaperStatus.WITHDRAWN:
        raise exceptions.BusinessRuleError("Cannot change status of a withdrawn paper.")
    
    paper.status = decision_data.status
    
    if decision_data.note is not None:
        paper.decision_note = decision_data.note
    
    db.commit()
    db.refresh(paper)
    return paper

def submit_camera_ready(
    db: Session, 
    paper_id: int, 
    submitter_id: int, 
    file_path: str
) -> models.PaperVersion:
    
    paper = db.query(models.Paper).filter(models.Paper.id == paper_id).first()
    if not paper:
        raise exceptions.PaperNotFoundError(f"Paper {paper_id} not found")
    
    if paper.submitter_id != submitter_id:
        raise exceptions.BusinessRuleError("You are not the owner of this paper.")

    if paper.status != models.PaperStatus.ACCEPTED:
        raise exceptions.BusinessRuleError(
            f"Cannot submit Camera-Ready version. Paper status is '{paper.status}', but must be 'ACCEPTED'."
        )
    
    validate_camera_ready_window(paper.conference_id)

    # ========================================================
    # 🔥 [FIX] TÌM ĐƯỜNG DẪN FILE THỰC TẾ TRÊN Ổ CỨNG 🔥
    # ========================================================
    real_path = file_path
    
    # Nếu đường dẫn hiện tại không tồn tại, thử tìm trong thư mục "uploads"
    if not os.path.exists(real_path):
        # Trường hợp 1: file_path là "papers/..." -> thử "uploads/papers/..."
        possible_path_1 = os.path.join("uploads", file_path)
        
        # Trường hợp 2: file_path là "/papers/..." -> bỏ dấu "/" đầu rồi thử
        possible_path_2 = os.path.join("uploads", file_path.lstrip("/"))

        if os.path.exists(possible_path_1):
            real_path = possible_path_1
        elif os.path.exists(possible_path_2):
            real_path = possible_path_2
        
        # Nếu vẫn không thấy thì PdfReader bên dưới sẽ báo lỗi chi tiết

    try:
        reader = PdfReader(real_path) # Đọc file bằng đường dẫn thực tế
        num_pages = len(reader.pages)
        
        MAX_PAGES = 15
        if num_pages > MAX_PAGES:
            # Xóa file rác nếu vi phạm (dùng real_path)
            if os.path.exists(real_path):
                os.remove(real_path)
            raise exceptions.BusinessRuleError(f"File exceeds page limit. Max is {MAX_PAGES}, got {num_pages}.")
            
    except Exception as e:
        # Xóa file rác nếu lỗi (dùng real_path)
        if os.path.exists(real_path):
            os.remove(real_path)
            
        # Log lỗi rõ ràng hơn để debug
        print(f"Error reading PDF at '{real_path}': {str(e)}")
        raise exceptions.BusinessRuleError(f"Invalid PDF file. Details: {str(e)}")

    next_ver = get_next_version_number(db, paper_id)

    new_version = models.PaperVersion(
        paper_id=paper_id,
        version_number=next_ver,
        file_url=file_path, 
        is_camera_ready=True,  
        is_anonymous=False 
    )
    
    db.add(new_version)
    db.commit()
    db.refresh(new_version)
    
    return new_version

def check_spelling_with_ai(text: str):
    payload = {
        "text": text,
        "type": "ABSTRACT"
    }
    try:
        response = requests.post(f"{settings.INTELLIGENT_URL}/author/refine", json=payload, timeout=10)
        if response.status_code == 200:
            return response.json()
    except Exception as e:
        print(f"AI Service unavailable: {e}")
        return None
    
def send_notification_email(to_email: str, subject: str, content: str):
    payload = {
        "email": to_email,
        "subject": subject,
        "content": content
    }
    
    try:
        requests.post(settings.NOTIFICATION_URL, json=payload, timeout=5)
    except Exception as e:
        print(f"Failed to send email notification: {e}")

def update_author(db: Session, paper_id: int, author_id: int, submitter_id: int, author_data: schemas.AuthorUpdate):
    # 1. Check quyền sở hữu
    paper = check_paper_ownership(db, paper_id, submitter_id)

    # 2. Check trạng thái đóng cứng
    if paper.status in [models.PaperStatus.REJECTED, models.PaperStatus.WITHDRAWN]:
        raise exceptions.BusinessRuleError("Cannot edit authors of a closed paper.")

    # 3. Check Deadline theo từng giai đoạn (ĐÃ FIX)
    if paper.status == models.PaperStatus.ACCEPTED:
        # Nếu đã Accepted -> Check hạn Camera-ready
        validate_camera_ready_window(paper.conference_id)
    elif paper.status == models.PaperStatus.REVISION_REQUIRED:
        # Nếu đang yêu cầu sửa -> Luôn cho phép (hoặc check revision deadline nếu có)
        pass 
    else:
        validate_submission_window(paper.conference_id)

    # 4. Tìm tác giả cần sửa
    author = db.query(models.PaperAuthor).filter(
        models.PaperAuthor.id == author_id,
        models.PaperAuthor.paper_id == paper_id
    ).first()

    if not author:
        raise exceptions.AuthorNotFoundError(f"Author {author_id} not found in paper {paper_id}")

    # 5. Check trùng Email (nếu có đổi email)
    if author_data.email and author_data.email != author.email:
        exists = db.query(models.PaperAuthor).filter(
            models.PaperAuthor.paper_id == paper_id,
            models.PaperAuthor.email == author_data.email
        ).first()
        if exists:
            raise exceptions.BusinessRuleError(f"Author with email '{author_data.email}' already exists in this paper.")

    # 6. Cập nhật dữ liệu
    if author_data.full_name is not None:
        author.full_name = author_data.full_name
    if author_data.email is not None:
        author.email = author_data.email
    if author_data.organization is not None:
        author.organization = author_data.organization

    # 7. Xử lý Corresponding Author (Chỉ 1 người được là True)
    if author_data.is_corresponding is not None:
        if author_data.is_corresponding:
            db.query(models.PaperAuthor).filter(
                models.PaperAuthor.paper_id == paper_id
            ).update({models.PaperAuthor.is_corresponding: False})
        
        author.is_corresponding = author_data.is_corresponding

    db.commit()
    db.refresh(author)
    return author


def get_camera_ready_by_conference(db: Session, conference_id: int):
    # Lấy paper đã ACCEPTED và preload authors, versions
    papers = (
        db.query(models.Paper)
        .options(
            selectinload(models.Paper.authors),
            selectinload(models.Paper.versions),
        )
        .filter(models.Paper.conference_id == conference_id)
        .filter(models.Paper.status == models.PaperStatus.ACCEPTED)
        .all()
    )
    return [p for p in papers if any(v.is_camera_ready for v in p.versions)]


def get_proceedings_by_conference(db: Session, conference_id: int):
    papers = get_camera_ready_by_conference(db, conference_id)

    out = []
    for p in papers:
        cr_versions = [v for v in p.versions if v.is_camera_ready]
        if not cr_versions:
            continue
            
        cr = sorted(cr_versions, key=lambda x: x.version_number, reverse=True)[0]

        out.append({
            "paper_id": p.id,
            "title": p.title,
            "track_id": p.track_id,
            "submitted_at": p.submitted_at,
            "camera_ready_file_url": cr.file_url,
            "authors": [
                {
                    "full_name": a.full_name,
                    "email": a.email,
                    "organization": a.organization,
                    "is_corresponding": a.is_corresponding,
                }
                for a in p.authors
            ]
        })
    return out

def _parse_deadline(deadline_value):
    if not deadline_value:
        return None
    try:
        # Xử lý chuỗi ISO từ JSON (thường có Z ở cuối)
        s = str(deadline_value).replace("Z", "+00:00")
        return datetime.fromisoformat(s)
    except Exception:
        return None

def validate_camera_ready_window(conference_id: int):
    """Gọi sang Conference Service để kiểm tra phase Camera-ready"""
    conf_base = getattr(settings, "CONFERENCE_SERVICE_URL", "http://conference-service:8000").rstrip("/")
    try:
        r = httpx.get(f"{conf_base}/api/conferences/{conference_id}", timeout=5.0)
    except httpx.RequestError:
        raise exceptions.BusinessRuleError("Cannot connect to Conference Service to validate camera-ready window.")

    if r.status_code != 200:
        raise exceptions.BusinessRuleError("Cannot read conference data.")

    data = r.json()
    
    # 1. Check công tắc mở/đóng
    if not data.get("camera_ready_open", False):
        raise exceptions.BusinessRuleError("Camera-ready submission is currently CLOSED for this conference.")

    # 2. Check deadline
    deadline_dt = _parse_deadline(data.get("camera_ready_deadline"))
    if deadline_dt:
        now = datetime.now(deadline_dt.tzinfo) if deadline_dt.tzinfo else datetime.now()
        if now > deadline_dt:
            raise exceptions.BusinessRuleError("Camera-ready deadline has passed.")

    return True

def _pick_latest_camera_ready_version(paper) -> Optional[models.PaperVersion]:
    versions = list(paper.versions or [])
    cr = [v for v in versions if getattr(v, "is_camera_ready", False)]
    if not cr:
        return None
    cr.sort(key=lambda v: (v.version_number or 0), reverse=True)
    return cr[0]

def get_camera_ready_status_by_conference(db, conference_id: int, auth_header: Optional[str] = None) -> List[dict]:
    papers = (
        db.query(models.Paper)
        .options(
            selectinload(models.Paper.authors),
            selectinload(models.Paper.versions),
            selectinload(models.Paper.topics),
        )
        .filter(
            models.Paper.conference_id == conference_id,
            models.Paper.status == models.PaperStatus.ACCEPTED,
        )
        .order_by(models.Paper.id.asc())
        .all()
    )

    # ✅ cache để không gọi identity N lần
    profile_cache = {}

    out = []
    for p in papers:
        latest_cr = _pick_latest_camera_ready_version(p)

        sid = int(p.submitter_id) if p.submitter_id is not None else None
        submitter_profile = None
        if sid:
            if sid not in profile_cache:
                profile_cache[sid] = get_user_profile_or_none(sid, auth_header=auth_header)
            submitter_profile = profile_cache[sid]

        out.append({
            # ===== BẮT BUỘC: PaperResponse fields =====
            "id": p.id,
            "title": p.title,
            "abstract": p.abstract,
            "keywords": p.keywords or [],
            "conference_id": p.conference_id,
            "track_id": p.track_id,
            "is_blind_mode": p.is_blind_mode,

            "submitter_id": p.submitter_id,
            "status": p.status,
            "decision_note": p.decision_note,

            "submitted_at": p.submitted_at,
            "created_at": p.created_at,

            "authors": p.authors,
            "topics": p.topics,
            "versions": p.versions,

            # ===== Extra status fields =====
            "has_camera_ready": bool(latest_cr),
            "camera_ready_file_url": getattr(latest_cr, "file_url", None) if latest_cr else None,
            "camera_ready_submitted_at": getattr(latest_cr, "created_at", None) if latest_cr else None,
            "camera_ready_version": getattr(latest_cr, "version_number", None) if latest_cr else None,

            # ✅ thêm profile submitter
            "submitter_profile": submitter_profile,
        })

    return out

def _normalize_base_url(url: str) -> str:
    return (url or "").rstrip("/")

def get_user_profile_or_none(user_id: int, auth_header: Optional[str] = None) -> Optional[Dict]:
    base = _normalize_base_url(getattr(settings, "IDENTITY_SERVICE_URL", "http://identity-service:8000"))
    url = f"{base}/api/users/{user_id}"

    headers = {}
    # identity của bạn hiện KHÔNG require token cho GET /{user_id}
    # nhưng forward Authorization để sau này nếu bạn siết auth cũng không phải sửa lại
    if auth_header:
        headers["Authorization"] = auth_header

    try:
        r = httpx.get(url, headers=headers, timeout=5.0)
        if r.status_code != 200:
            return None
        u = r.json()
        return {
            "id": u.get("id"),
            "full_name": u.get("full_name"),
            "email": u.get("email"),
            "organization": u.get("organization"),
            "department": u.get("department"),
            "phone": u.get("phone"),
        }
    except httpx.RequestError:
        return None
    
def get_camera_ready_status_all_conferences(
    db: Session,
    auth_header: Optional[str] = None
) -> List[dict]:
    papers = (
        db.query(models.Paper)
        .options(
            selectinload(models.Paper.authors),
            selectinload(models.Paper.versions),
            selectinload(models.Paper.topics),
        )
        .filter(models.Paper.status == models.PaperStatus.ACCEPTED)
        .order_by(models.Paper.conference_id.asc(), models.Paper.id.asc())
        .all()
    )

    profile_cache: Dict[int, Optional[Dict]] = {}
    out: List[dict] = []

    for p in papers:
        latest_cr = _pick_latest_camera_ready_version(p)

        # ✅ CHỈ LẤY paper có camera-ready
        if not latest_cr:
            continue

        sid = int(p.submitter_id) if p.submitter_id is not None else None
        submitter_profile = None
        if sid:
            if sid not in profile_cache:
                profile_cache[sid] = get_user_profile_or_none(sid, auth_header=auth_header)
            submitter_profile = profile_cache[sid]

        out.append({
            # ===== PaperResponse fields =====
            "id": p.id,
            "title": p.title,
            "abstract": p.abstract,
            "keywords": p.keywords or [],
            "conference_id": p.conference_id,
            "track_id": p.track_id,
            "is_blind_mode": p.is_blind_mode,

            "submitter_id": p.submitter_id,
            "status": p.status,
            "decision_note": p.decision_note,

            "submitted_at": p.submitted_at,
            "created_at": p.created_at,

            "authors": p.authors,
            "topics": p.topics,
            "versions": p.versions,

            # ===== Extra status fields =====
            "has_camera_ready": True,
            "camera_ready_file_url": getattr(latest_cr, "file_url", None),
            "camera_ready_submitted_at": getattr(latest_cr, "created_at", None),
            "camera_ready_version": getattr(latest_cr, "version_number", None),

            "submitter_profile": submitter_profile,
        })

    return out

def get_paper_detail_for_chair(db: Session, paper_id: int, auth_header: Optional[str] = None) -> dict:
    p = (
        db.query(models.Paper)
        .options(
            selectinload(models.Paper.authors),
            selectinload(models.Paper.versions),
            selectinload(models.Paper.topics),
        )
        .filter(models.Paper.id == paper_id)
        .first()
    )
    if not p:
        raise exceptions.PaperNotFoundError(f"Paper {paper_id} not found")

    latest_cr = _pick_latest_camera_ready_version(p)

    submitter_profile = None
    sid = int(p.submitter_id) if p.submitter_id is not None else None
    if sid:
        submitter_profile = get_user_profile_or_none(sid, auth_header=auth_header)

    return {
        "id": p.id,
        "title": p.title,
        "abstract": p.abstract,
        "keywords": p.keywords or [],
        "conference_id": p.conference_id,
        "track_id": p.track_id,
        "is_blind_mode": p.is_blind_mode,

        "submitter_id": p.submitter_id,
        "status": p.status,
        "decision_note": p.decision_note,
        "submitted_at": p.submitted_at,
        "created_at": p.created_at,

        "authors": p.authors,
        "topics": p.topics,
        "versions": p.versions,

        "has_camera_ready": bool(latest_cr),
        "camera_ready_file_url": getattr(latest_cr, "file_url", None) if latest_cr else None,
        "camera_ready_submitted_at": getattr(latest_cr, "created_at", None) if latest_cr else None,
        "camera_ready_version": getattr(latest_cr, "version_number", None) if latest_cr else None,

        "submitter_profile": submitter_profile,
    }


def upsert_proceedings_meta(db: Session, conference_id: int, meta) -> models.Proceedings:
    pr = db.query(models.Proceedings).filter(models.Proceedings.conference_id == conference_id).first()
    if not pr:
        pr = models.Proceedings(conference_id=conference_id, title=meta.title)
        db.add(pr)

    pr.title = meta.title
    pr.isbn_issn = meta.isbn_issn
    pr.volume = meta.volume
    pr.publisher = meta.publisher
    pr.published_date = meta.published_date
    pr.cover_image_url = meta.cover_image_url
    pr.preface = meta.preface
    pr.copyright = meta.copyright
    pr.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(pr)
    return pr

def set_proceedings_papers(db: Session, conference_id: int, paper_ids: list[int]) -> models.Proceedings:
    pr = db.query(models.Proceedings).filter(models.Proceedings.conference_id == conference_id).first()
    if not pr:
        raise exceptions.BusinessRuleError("Proceedings metadata not found. Save metadata first.")

    # clear old items
    db.execute(delete(models.ProceedingsItem).where(models.ProceedingsItem.proceedings_id == pr.id))

    # insert new items with order
    for idx, pid in enumerate(paper_ids):
        db.add(models.ProceedingsItem(proceedings_id=pr.id, paper_id=int(pid), sort_order=idx))

    db.commit()
    db.refresh(pr)
    return pr

def publish_proceedings(db: Session, conference_id: int, is_published: bool) -> models.Proceedings:
    pr = db.query(models.Proceedings).filter(models.Proceedings.conference_id == conference_id).first()
    if not pr:
        raise exceptions.BusinessRuleError("Proceedings metadata not found.")

    if is_published:
        if not pr.title or not pr.title.strip():
            raise exceptions.BusinessRuleError("Proceedings title is required.")
        if not pr.items or len(pr.items) == 0:
            raise exceptions.BusinessRuleError("Please select at least 1 paper to publish.")

    pr.is_published = bool(is_published)
    db.commit()
    db.refresh(pr)
    return pr

def get_proceedings_detail(db: Session, conference_id: int) -> dict:
    pr = db.query(models.Proceedings).filter(models.Proceedings.conference_id == conference_id).first()
    if not pr:
        return None
    paper_ids = [it.paper_id for it in sorted(pr.items, key=lambda x: x.sort_order)]
    return {
        "conference_id": pr.conference_id,
        "title": pr.title,
        "isbn_issn": pr.isbn_issn,
        "volume": pr.volume,
        "publisher": pr.publisher,
        "published_date": pr.published_date,
        "cover_image_url": pr.cover_image_url,
        "preface": pr.preface,
        "copyright": pr.copyright,
        "is_published": pr.is_published,
        "paper_ids": paper_ids,
        "updated_at": pr.updated_at,
    }

def get_public_proceedings(db: Session, conference_id: int) -> dict:
    data = get_proceedings_detail(db, conference_id)
    if not data or not data["is_published"]:
        return None
    return data

def list_conferences_with_camera_ready(db: Session) -> List[dict]:
    # Join PaperVersion để chỉ lấy paper có is_camera_ready=True
    rows = (
        db.query(models.Paper.conference_id, func.count(func.distinct(models.Paper.id)))
        .join(models.PaperVersion, models.PaperVersion.paper_id == models.Paper.id)
        .filter(models.Paper.status == models.PaperStatus.ACCEPTED)
        .filter(models.PaperVersion.is_camera_ready == True)
        .group_by(models.Paper.conference_id)
        .order_by(models.Paper.conference_id.asc())
        .all()
    )

    return [
        {
            "conference_id": int(conf_id),
            "conference_name": None,
            "camera_ready_papers": int(cnt),
        }
        for conf_id, cnt in rows
    ]


def get_next_version_number(db: Session, paper_id: int) -> int:
    last_ver = (
        db.query(models.PaperVersion)
        .filter(models.PaperVersion.paper_id == paper_id)
        .order_by(desc(models.PaperVersion.version_number))
        .first()
    )
    return 1 if not last_ver else last_ver.version_number + 1


   
def send_notification_email(to_email: str, subject: str, content: str):
    payload = {
        "email": to_email,
        "subject": subject,
        "content": content
    }
    
    try:
        requests.post(settings.NOTIFICATION_URL, json=payload, timeout=5)
    except Exception as e:
        print(f"Failed to send email notification: {e}")


def get_papers_for_bidding(db: Session, exclude_submitter_id: int = None) -> list[models.Paper]:
    """
    Lấy danh sách bài cho Reviewer chọn (Bidding).
    """
    query = (
        db.query(models.Paper)
        .options(
            selectinload(models.Paper.topics),
        )
        .filter(models.Paper.status == models.PaperStatus.SUBMITTED)
    )

    if exclude_submitter_id:
        query = query.filter(models.Paper.submitter_id != exclude_submitter_id)

    return query.order_by(desc(models.Paper.submitted_at)).all()
