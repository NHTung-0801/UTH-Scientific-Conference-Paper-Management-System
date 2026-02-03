from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, BackgroundTasks, Header
from sqlalchemy.orm import Session, selectinload
from io import BytesIO, StringIO
from typing import List, Optional
import json
import httpx
from fastapi import Request, Query
import os
import csv
from openpyxl import Workbook
from fastapi.responses import StreamingResponse
import shutil
from datetime import datetime
from uuid import uuid4
from .. import database, crud, schemas, exceptions, models
from ..config import settings
from ..utils.file_handler import save_paper_file, delete_paper_version_file, save_proceedings_cover
from ..security.deps import get_current_payload, require_roles
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet


router = APIRouter(
    prefix="/submissions",
    tags=["Submissions"]
)

# -----------------------------
# Helpers
# -----------------------------
def _normalize_base_url(url: str) -> str:
    if not url:
        return ""
    return url.rstrip("/")

def _notification_endpoint() -> str:
    base = _normalize_base_url(settings.NOTIFICATION_SERVICE_URL)
    if not base:
        return "/api/notifications"
    if base.endswith("/api/notifications"):
        return base
    return f"{base}/api/notifications"

def _flatten_proceedings_rows(data: list[dict], conference_id: int):
    """
    data: crud.get_proceedings_by_conference(db, conference_id)
    => List[dict]
    """
    def pick_corresponding(authors: list[dict]):
        if not authors:
            return ("", "")
        for a in authors:
            if a.get("is_corresponding") is True:
                return (a.get("full_name") or "", a.get("email") or "")
        a0 = authors[0]
        return (a0.get("full_name") or "", a0.get("email") or "")

    rows = []
    for p in (data or []):
        name, email = pick_corresponding(p.get("authors") or [])
        rows.append({
            "paper_id": p.get("paper_id"),
            "title": p.get("title"),
            "track_id": p.get("track_id"),
            "submitted_at": (p.get("submitted_at") or ""),
            "corresponding_name": name,
            "corresponding_email": email,
            "camera_ready_file_url": p.get("camera_ready_file_url") or "",
            "authors_count": len(p.get("authors") or []),
        })

    headers = [
        "paper_id",
        "title",
        "track_id",
        "submitted_at",
        "corresponding_name",
        "corresponding_email",
        "camera_ready_file_url",
        "authors_count",
    ]
    return headers, rows


def _stream_export_file(conference_id: int, format: str, headers: list[str], rows: list[dict]):

    # ===== PDF =====
    if format == "pdf":
        bio = BytesIO()
        doc = SimpleDocTemplate(bio, pagesize=A4)
        styles = getSampleStyleSheet()
        story = []

        story.append(Paragraph(f"Proceedings - Conference #{conference_id}", styles["Title"]))
        story.append(Spacer(1, 12))

        data = [headers] + [[str(r.get(h, "") or "") for h in headers] for r in rows]

        table = Table(data, repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f2f2f2")),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#dddddd")),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#fafafa")]),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))

        story.append(table)
        doc.build(story)

        bio.seek(0)
        filename = f"proceedings_conference_{conference_id}.pdf"
        return StreamingResponse(
            bio,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    # ===== CSV =====
    if format == "csv":
        si = StringIO()
        writer = csv.DictWriter(si, fieldnames=headers)
        writer.writeheader()
        for r in rows:
            writer.writerow({h: r.get(h, "") for h in headers})

        bio = BytesIO(si.getvalue().encode("utf-8-sig"))
        filename = f"proceedings_conference_{conference_id}.csv"
        return StreamingResponse(
            bio,
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    # ===== XLSX =====
    if format == "xlsx":
        wb = Workbook()
        ws = wb.active
        ws.title = "Proceedings"
        ws.append(headers)
        for r in rows:
            ws.append([r.get(h, "") for h in headers])

        bio = BytesIO()
        wb.save(bio)
        bio.seek(0)
        filename = f"proceedings_conference_{conference_id}.xlsx"
        return StreamingResponse(
            bio,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    # format lạ
    raise HTTPException(status_code=400, detail="Invalid format")


# --- HÀM GỌI API ---
def call_notification_service_task(payload: dict):
    notification_url = settings.NOTIFICATION_SERVICE_URL
    headers = {"X-Internal-Key": settings.INTERNAL_KEY}

    try:
        with httpx.Client(timeout=10.0) as client:
            res = client.post(notification_url, json=payload, headers=headers)
            if res.status_code == 201:
                print(f"[Submission Service] Notification sent for Paper #{payload.get('paper_id')}")
            else:
                print(f"[Submission Service] Failed: {res.status_code} {res.text}")
    except Exception as e:
        print(f"[Submission Service] Connection Error: {str(e)}")


# -----------------------------
# Reviewer/Chair/Admin: Open papers for bidding
# -----------------------------
@router.get(
    "/open-for-bidding",
    response_model=List[schemas.PaperBiddingResponse], 
    dependencies=[Depends(require_roles(["REVIEWER", "CHAIR", "ADMIN"]))],
)
def get_open_papers_for_bidding(
    db: Session = Depends(database.get_db),
    payload=Depends(get_current_payload),
):
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token missing user_id")

    papers = crud.get_papers_for_bidding(db, exclude_submitter_id=user_id)
    return papers


# API nộp bài: AUTHOR/ADMIN
@router.post(
    "/",
    response_model=schemas.PaperResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(["AUTHOR", "ADMIN"]))],
)
def submit_paper(
    background_tasks: BackgroundTasks,
    metadata: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(database.get_db),
    payload=Depends(get_current_payload),
):
    created_paper_id = None
    created_version_number = None

    submitter_id = payload.get("user_id")
    if not submitter_id:
        raise HTTPException(status_code=401, detail="Token missing user_id")

    try:
        try:
            data_dict = json.loads(metadata)
            paper_data = schemas.PaperCreate(**data_dict)
        except Exception as json_error:
            raise HTTPException(status_code=400, detail=f"Invalid JSON format: {str(json_error)}")

        paper = crud.create_paper(
            db=db,
            paper_data=paper_data,
            submitter_id=submitter_id,
        )
        created_paper_id = paper.id

        version = crud.create_new_paper_version(
            db=db,
            paper_id=paper.id,
            file_url="TEMP_URL_HOLDER",
            is_blind_mode=paper.is_blind_mode,
        )
        created_version_number = version.version_number

        file_url = save_paper_file(
            paper_id=paper.id,
            version_number=version.version_number,
            upload_file=file,
        )
        version.file_url = file_url

        db.commit()
        db.refresh(paper)

        recipient_email = None
        recipient_name = "Author"

        if paper_data.authors:
            recipient_email = paper_data.authors[0].email
            recipient_name = paper_data.authors[0].full_name

            for author in paper_data.authors:
                if author.is_corresponding:
                    recipient_email = author.email
                    recipient_name = author.full_name
                    break

        notification_payload = {
            "receiver_id": submitter_id,
            "receiver_email": recipient_email,
            "receiver_name": recipient_name,
            "paper_id": paper.id,
            "paper_title": paper.title,
            "subject": f"Xác nhận nộp bài: {paper.title}",
            "body": f"Bài báo #{paper.id} đã được nộp thành công vào hệ thống. Vui lòng chờ phản hồi.",
        }
        background_tasks.add_task(call_notification_service_task, notification_payload)

        return paper

    except Exception as e:
        db.rollback()
        print(f" Error submitting paper: {str(e)}")

        if created_paper_id is not None and created_version_number is not None:
            try:
                delete_paper_version_file(
                    paper_id=created_paper_id,
                    version_number=created_version_number,
                )
            except Exception as cleanup_error:
                print(f" Failed to clean up file: {cleanup_error}")

        raise HTTPException(status_code=400, detail=f"Submission failed: {str(e)}")


# Danh sách bài đã nộp: AUTHOR/ADMIN (chỉ của chính mình)
@router.get(
    "",
    response_model=List[schemas.PaperResponse],
    dependencies=[Depends(require_roles(["AUTHOR", "ADMIN"]))],
)
def get_my_submissions(
    db: Session = Depends(database.get_db),
    payload=Depends(get_current_payload),
):
    submitter_id = payload.get("user_id")
    if not submitter_id:
        raise HTTPException(status_code=401, detail="Token missing user_id")

    return crud.get_papers_by_author(db, submitter_id)


# =========================================================
# 👇 ĐÃ SỬA: Xem chi tiết bài báo (Hỗ trợ Internal Key)
# =========================================================
@router.get(
    "/{paper_id}",
    response_model=schemas.PaperResponse,
)
def get_submission_detail(
    paper_id: int,
    db: Session = Depends(database.get_db),
    payload: dict = Depends(get_current_payload),  # Vẫn validate token user (nếu có)
    x_internal_key: Optional[str] = Header(default=None) # Hứng Internal Key
):
    # 1. ƯU TIÊN: Kiểm tra Internal Key (Service-to-Service)
    # Nếu Key đúng -> Cho phép lấy bài báo bất kỳ (dùng cho AI Service, Review Service...)
    if x_internal_key and x_internal_key == settings.INTERNAL_KEY:
        # Lấy bài báo trực tiếp từ DB (bỏ qua check owner)
        paper = db.query(models.Paper).filter(models.Paper.id == paper_id).first()
        if not paper:
            raise HTTPException(status_code=404, detail="Paper not found")
        return paper

    # 2. NẾU KHÔNG CÓ KEY -> Kiểm tra quyền User như bình thường
    submitter_id = payload.get("user_id")
    roles = payload.get("roles", [])

    if not submitter_id:
        raise HTTPException(status_code=401, detail="Token missing user_id")

    # Admin hoặc Chair được xem mọi bài
    if "ADMIN" in roles or "CHAIR" in roles:
         paper = db.query(models.Paper).filter(models.Paper.id == paper_id).first()
         if not paper:
            raise HTTPException(status_code=404, detail="Paper not found")
         return paper

    # Author chỉ được xem bài của mình
    if "AUTHOR" in roles:
        try:
            return crud.get_author_paper_detail(db=db, paper_id=paper_id, submitter_id=submitter_id)
        except exceptions.PaperNotFoundError as e:
            raise HTTPException(status_code=404, detail=str(e))
        except exceptions.NotAuthorizedError as e:
             raise HTTPException(status_code=403, detail="Bạn không có quyền xem bài này.")

    # Các role khác (Reviewer) nếu không đi qua Internal Key thì không cho xem ở API này
    raise HTTPException(status_code=403, detail="Access denied")


# Thêm tác giả: AUTHOR/ADMIN
@router.post(
    "/{paper_id}/authors",
    response_model=schemas.AuthorResponse,
    dependencies=[Depends(require_roles(["AUTHOR", "ADMIN"]))],
)
def add_co_author(
    paper_id: int,
    author_data: schemas.AuthorAdd,
    db: Session = Depends(database.get_db),
    payload=Depends(get_current_payload),
):
    submitter_id = payload.get("user_id")
    if not submitter_id:
        raise HTTPException(status_code=401, detail="Token missing user_id")

    try:
        return crud.add_author(db, paper_id, submitter_id, author_data)

    except exceptions.PaperNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except exceptions.NotAuthorizedError as e:
        raise HTTPException(status_code=403, detail=e.message)
    except exceptions.BusinessRuleError as e:
        raise HTTPException(status_code=400, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Xoá tác giả: AUTHOR/ADMIN
@router.delete(
    "/{paper_id}/authors/{author_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(["AUTHOR", "ADMIN"]))],
)
def remove_co_author(
    paper_id: int,
    author_id: int,
    db: Session = Depends(database.get_db),
    payload=Depends(get_current_payload),
):
    submitter_id = payload.get("user_id")
    if not submitter_id:
        raise HTTPException(status_code=401, detail="Token missing user_id")

    try:
        crud.remove_author(db, paper_id, author_id, submitter_id)
        return
    except exceptions.AuthorNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except exceptions.NotAuthorizedError as e:
        raise HTTPException(status_code=403, detail=e.message)
    except exceptions.BusinessRuleError as e:
        raise HTTPException(status_code=400, detail=e.message)


# Rút bài: AUTHOR/ADMIN
@router.post(
    "/{paper_id}/withdraw",
    response_model=schemas.PaperResponse,
    dependencies=[Depends(require_roles(["AUTHOR", "ADMIN"]))],
)
def withdraw_submission(
    paper_id: int,
    db: Session = Depends(database.get_db),
    payload=Depends(get_current_payload),
):
    submitter_id = payload.get("user_id")
    if not submitter_id:
        raise HTTPException(status_code=401, detail="Token missing user_id")

    try:
        return crud.withdraw_paper(db, paper_id, submitter_id)
    except exceptions.PaperNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except exceptions.NotAuthorizedError as e:
        raise HTTPException(status_code=403, detail=e.message)
    except exceptions.BusinessRuleError as e:
        raise HTTPException(status_code=400, detail=e.message)


# Update metadata: AUTHOR/ADMIN
@router.put(
    "/{paper_id}",
    response_model=schemas.PaperResponse,
    dependencies=[Depends(require_roles(["AUTHOR", "ADMIN"]))],
)
def update_paper_details(
    paper_id: int,
    update_data: schemas.PaperUpdate,
    db: Session = Depends(database.get_db),
    payload=Depends(get_current_payload),
):
    submitter_id = payload.get("user_id")
    if not submitter_id:
        raise HTTPException(status_code=401, detail="Token missing user_id")

    try:
        return crud.update_paper_metadata(db, paper_id, submitter_id, update_data)
    except exceptions.PaperNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except exceptions.NotAuthorizedError as e:
        raise HTTPException(status_code=403, detail=e.message)
    except exceptions.BusinessRuleError as e:
        raise HTTPException(status_code=400, detail=e.message)


def _parse_deadline(deadline_value):
    if not deadline_value:
        return None
    try:
        s = str(deadline_value).replace("Z", "+00:00")
        return datetime.fromisoformat(s)
    except Exception:
        return None


@router.post(
    "/{paper_id}/camera-ready",
    response_model=schemas.PaperVersionResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(["AUTHOR", "ADMIN"]))],
)
def upload_camera_ready(
    paper_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(database.get_db),
    payload=Depends(get_current_payload),
):
    # 1) auth
    submitter_id = payload.get("user_id")
    if not submitter_id:
        raise HTTPException(status_code=401, detail="Token missing user_id")

    # 2) validate file (đừng chỉ dựa content_type)
    filename = (file.filename or "").lower()
    if not (file.content_type == "application/pdf" or filename.endswith(".pdf")):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed.")

    # 3) paper exist + owner + ACCEPTED
    paper = db.query(models.Paper).filter(models.Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    if paper.submitter_id != submitter_id:
        raise HTTPException(status_code=403, detail="Not allowed (only submitter can upload camera-ready)")

    if paper.status != models.PaperStatus.ACCEPTED:
        raise HTTPException(status_code=400, detail="Paper is not ACCEPTED, cannot submit camera-ready")

    # 4) check conference phase (open + deadline)
    phase = get_conference_phase_or_502(paper.conference_id)

    if not phase.get("camera_ready_open", False):
        raise HTTPException(status_code=400, detail="Camera-ready is not open for this conference")

    deadline_dt = _parse_deadline(phase.get("camera_ready_deadline"))
    if deadline_dt:
        now = datetime.now(deadline_dt.tzinfo) if deadline_dt.tzinfo else datetime.now()
        if now > deadline_dt:
            raise HTTPException(status_code=400, detail="Camera-ready deadline has passed")

    created_version_number = None

    try:
        # 5) lưu file theo chuẩn chung (khuyến nghị)
        next_ver = crud.get_next_version_number(db, paper_id)
        created_version_number = next_ver

        file_url = save_paper_file(
            paper_id=paper_id,
            version_number=next_ver,
            upload_file=file,
        )

        # 6) tạo bản camera-ready (crud sẽ set is_camera_ready=True)
        # lưu file_url vào DB
        return crud.submit_camera_ready(
            db=db,
            paper_id=paper_id,
            submitter_id=submitter_id,
            file_path=file_url,
        )

    except exceptions.PaperNotFoundError as e:
        if created_version_number:
            try:
                delete_paper_version_file(paper_id=paper_id, version_number=created_version_number)
            except Exception:
                pass
        raise HTTPException(status_code=404, detail=str(e))

    except exceptions.NotAuthorizedError as e:
        if created_version_number:
            try:
                delete_paper_version_file(paper_id=paper_id, version_number=created_version_number)
            except Exception:
                pass
        raise HTTPException(status_code=403, detail=str(e))

    except exceptions.BusinessRuleError as e:
        if created_version_number:
            try:
                delete_paper_version_file(paper_id=paper_id, version_number=created_version_number)
            except Exception:
                pass
        raise HTTPException(status_code=400, detail=str(e))

    except Exception as e:
        if created_version_number:
            try:
                delete_paper_version_file(paper_id=paper_id, version_number=created_version_number)
            except Exception:
                pass
        raise HTTPException(status_code=500, detail=f"Camera-ready submission failed: {str(e)}")

# Quyết định bài: CHAIR/ADMIN
@router.put(
    "/{paper_id}/decision",
    response_model=schemas.PaperResponse,
    dependencies=[Depends(require_roles(["CHAIR", "ADMIN"]))],
)
def make_decision_on_paper(
    paper_id: int,
    decision: schemas.PaperDecision,
    db: Session = Depends(database.get_db),
):
    try:
        return crud.update_paper_decision(db=db, paper_id=paper_id, decision_data=decision)
    except exceptions.PaperNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except exceptions.BusinessRuleError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    
# UPDATE tác giả: AUTHOR/ADMIN
@router.put(
    "/{paper_id}/authors/{author_id}",
    response_model=schemas.AuthorResponse,
    dependencies=[Depends(require_roles(["AUTHOR", "ADMIN"]))],
)
def update_author(
    paper_id: int,
    author_id: int,
    author_data: schemas.AuthorUpdate,   # tạo schema mới
    db: Session = Depends(database.get_db),
    payload=Depends(get_current_payload),
):
    submitter_id = payload.get("user_id")
    if not submitter_id:
        raise HTTPException(status_code=401, detail="Token missing user_id")

    try:
        return crud.update_author(db, paper_id, author_id, submitter_id, author_data)
    except exceptions.PaperNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except exceptions.AuthorNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except exceptions.NotAuthorizedError as e:
        raise HTTPException(status_code=403, detail=e.message)
    except exceptions.BusinessRuleError as e:
        raise HTTPException(status_code=400, detail=e.message)

# ============================================================
# HÀM KIỂM TRA THỜI HẠN HỘI NGHỊ (INTERNAL CALL)
# ============================================================
def validate_conference_timeline(conference_id: int):
    conf_service_url = getattr(settings, "CONFERENCE_SERVICE_URL", "http://conference-service:8000")
    try:
        response = httpx.get(f"{conf_service_url}/api/conferences/{conference_id}", timeout=5.0)
        
        if response.status_code == 404:
            raise HTTPException(status_code=404, detail="Hội nghị không tồn tại hoặc đã bị xóa.")
        
        if response.status_code != 200:
            print(f"[Warning] Không thể check timeline. Status: {response.status_code}")
            return True             
        conf_data = response.json()
        
        try:
            start_str = str(conf_data.get("start_date", "")).replace("Z", "")
            end_str = str(conf_data.get("end_date", "")).replace("Z", "")
            
            start_date = datetime.fromisoformat(start_str)
            end_date = datetime.fromisoformat(end_str)
        except (ValueError, TypeError):
            print("[Warning] Lỗi format ngày tháng từ Conference Service")
            return True

        now = datetime.now()
        if now < start_date:
            raise HTTPException(
                status_code=400, 
                detail=f"Cổng nộp bài chưa mở (Bắt đầu: {start_date.strftime('%d/%m/%Y %H:%M')})"
            )
        
        if now > end_date:
             raise HTTPException(
                status_code=400, 
                detail=f"Đã hết hạn nộp bài (Hạn chót: {end_date.strftime('%d/%m/%Y %H:%M')})"
            )

        return True
    except httpx.RequestError as e:
        print(f"[Submission Service] Lỗi kết nối đến Conference Service: {str(e)}")
        return True
    

def get_conference_phase_or_502(conference_id: int) -> dict:
    conf_base = _normalize_base_url(getattr(settings, "CONFERENCE_SERVICE_URL", "http://conference-service:8000"))
    try:
        r = httpx.get(f"{conf_base}/api/conferences/{conference_id}/phase", timeout=5.0)
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="Cannot connect to Conference Service")

    if r.status_code == 404:
        raise HTTPException(status_code=404, detail="Conference not found")
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Cannot read conference phase: {r.text}")
    return r.json()


@router.get(
    "/conference/{conference_id}/camera-ready",
    response_model=List[schemas.PaperResponse],
    dependencies=[Depends(require_roles(["CHAIR", "ADMIN"]))],
)
def chair_list_camera_ready(
    conference_id: int,
    db: Session = Depends(database.get_db),
):
    return crud.get_camera_ready_by_conference(db, conference_id)

@router.get(
    "/conference/{conference_id}/proceedings",
    response_model=List[schemas.ProceedingsPaperOut],
    dependencies=[Depends(require_roles(["CHAIR", "ADMIN"]))],
)
def chair_export_proceedings(
    conference_id: int,
    db: Session = Depends(database.get_db),
):
    return crud.get_proceedings_by_conference(db, conference_id)

@router.get(
    "/conference/{conference_id}/camera-ready-status",
    response_model=List[schemas.CameraReadyStatusOut],
    dependencies=[Depends(require_roles(["CHAIR", "ADMIN"]))],
)
def chair_list_camera_ready_status(
    conference_id: int,
    request: Request,
    db: Session = Depends(database.get_db),
):
    auth = request.headers.get("authorization")
    return crud.get_camera_ready_status_by_conference(db, conference_id, auth_header=auth)

@router.get(
  "/camera-ready-status/all",
  response_model=List[schemas.CameraReadyStatusOut],
  dependencies=[Depends(require_roles(["CHAIR","ADMIN"]))],
)
def chair_list_camera_ready_status_all(
    request: Request,
    db: Session = Depends(database.get_db),
):
    auth = request.headers.get("authorization")
    return crud.get_camera_ready_status_all_conferences(db, auth_header=auth)


@router.get(
    "/chair/papers/{paper_id}",
    response_model=schemas.CameraReadyStatusOut, 
    dependencies=[Depends(require_roles(["CHAIR", "ADMIN"]))],
)
def chair_get_paper_detail(
    paper_id: int,
    request: Request,
    db: Session = Depends(database.get_db),
):
    auth = request.headers.get("authorization")
    return crud.get_paper_detail_for_chair(db, paper_id, auth_header=auth)

@router.get(
    "/conference/{conference_id}/proceedings/export",
    dependencies=[Depends(require_roles(["CHAIR", "ADMIN"]))],
)
def chair_export_proceedings_file(
    conference_id: int,
    format: str = Query("csv", pattern="^(csv|xlsx|pdf)$"),
    db: Session = Depends(database.get_db),
):
    data = crud.get_proceedings_by_conference(db, conference_id)
    headers, rows = _flatten_proceedings_rows(data, conference_id)
    return _stream_export_file(conference_id, format, headers, rows)



@router.get("/public/conference/{conference_id}/proceedings/export")
def public_export_proceedings_file(
    conference_id: int,
    format: str = Query("csv", pattern="^(csv|xlsx|pdf)$"),
    db: Session = Depends(database.get_db),
):
    # Nếu muốn CHỈ cho public tải những paper đã publish:
    meta = crud.get_public_proceedings(db, conference_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Proceedings not published.")

    all_rows = crud.get_proceedings_by_conference(db, conference_id)
    allow = set(meta["paper_ids"])
    published_rows = [p for p in all_rows if p.get("paper_id") in allow]

    headers, rows = _flatten_proceedings_rows(published_rows, conference_id)
    return _stream_export_file(conference_id, format, headers, rows)



# ==========================
# Chair: proceedings meta
# ==========================
@router.get(
    "/conference/{conference_id}/proceedings/meta",
    response_model=schemas.ProceedingsOut,
    dependencies=[Depends(require_roles(["CHAIR", "ADMIN"]))],
)
def chair_get_proceedings_meta(conference_id: int, db: Session = Depends(database.get_db)):
    data = crud.get_proceedings_detail(db, conference_id)
    if not data:
        return {
            "conference_id": conference_id,
            "title": "",
            "isbn_issn": None,
            "volume": None,
            "publisher": None,
            "published_date": None,
            "cover_image_url": None,
            "preface": None,
            "copyright": None,
            "is_published": False,
            "paper_ids": [],
            "updated_at": None
        }
    return data

@router.put(
    "/conference/{conference_id}/proceedings/meta",
    response_model=schemas.ProceedingsOut,
    dependencies=[Depends(require_roles(["CHAIR", "ADMIN"]))],
)
def chair_save_proceedings_meta(
    conference_id: int,
    meta: schemas.ProceedingsMetaIn,
    db: Session = Depends(database.get_db),
):
    pr = crud.upsert_proceedings_meta(db, conference_id, meta)
    return crud.get_proceedings_detail(db, conference_id)

@router.post(
    "/conference/{conference_id}/proceedings/cover",
    dependencies=[Depends(require_roles(["CHAIR", "ADMIN"]))],
)
def chair_upload_proceedings_cover(
    conference_id: int,
    file: UploadFile = File(...),
):
    # trả về đường dẫn cover_image_url để FE set vào meta
    url = save_proceedings_cover(conference_id, file)
    return {"cover_image_url": url}

@router.put(
    "/conference/{conference_id}/proceedings/papers",
    response_model=schemas.ProceedingsOut,
    dependencies=[Depends(require_roles(["CHAIR", "ADMIN"]))],
)
def chair_set_proceedings_papers(
    conference_id: int,
    body: schemas.ProceedingsPublishIn,
    db: Session = Depends(database.get_db),
):
    crud.set_proceedings_papers(db, conference_id, body.paper_ids)
    return crud.get_proceedings_detail(db, conference_id)

@router.post(
    "/conference/{conference_id}/proceedings/publish",
    response_model=schemas.ProceedingsOut,
    dependencies=[Depends(require_roles(["CHAIR", "ADMIN"]))],
)
def chair_publish_proceedings(
    conference_id: int,
    db: Session = Depends(database.get_db),
):
    crud.publish_proceedings(db, conference_id, True)
    return crud.get_proceedings_detail(db, conference_id)

@router.post(
    "/conference/{conference_id}/proceedings/unpublish",
    response_model=schemas.ProceedingsOut,
    dependencies=[Depends(require_roles(["CHAIR", "ADMIN"]))],
)
def chair_unpublish_proceedings(
    conference_id: int,
    db: Session = Depends(database.get_db),
):
    crud.publish_proceedings(db, conference_id, False)
    return crud.get_proceedings_detail(db, conference_id)


# ==========================
# Public endpoints (no auth)
# ==========================
@router.get("/public/conference/{conference_id}/proceedings", response_model=schemas.ProceedingsOut)
def public_get_proceedings(conference_id: int, db: Session = Depends(database.get_db)):
    data = crud.get_public_proceedings(db, conference_id)
    if not data:
        raise HTTPException(status_code=404, detail="Proceedings not published.")
    return data

@router.get("/public/conference/{conference_id}/proceedings/papers")
def public_get_proceedings_papers(conference_id: int, db: Session = Depends(database.get_db)):
    meta = crud.get_public_proceedings(db, conference_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Proceedings not published.")
    all_rows = crud.get_proceedings_by_conference(db, conference_id)
    allow = set(meta["paper_ids"])
    return [p for p in all_rows if p.get("paper_id") in allow]



