from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime
from . import models, schemas, exceptions
from .paper_state import get_paper_state


# Nghiệp vụ tạo bài báo mới
def create_paper(
    db: Session, 
    paper_data: schemas.PaperCreate, 
    submitter_id: int, 
    file_url: str
) -> models.Paper:
    
    try:
        # Tạo bài báo
        paper = models.Paper(
            title=paper_data.title,
            abstract=paper_data.abstract,
            conference_id=paper_data.conference_id,
            track_id=paper_data.track_id,
            submitter_id=submitter_id,
            is_blind_mode=paper_data.is_blind_mode,
            status=models.PaperStatus.SUBMITTED,
            submitted_at=datetime.utcnow()
            
        )
        db.add(paper)
        db.flush()

        # Lưu danh sách đồng giả
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

        # Lưu danh sách chủ đề
        if paper_data.topics:
            db_topics = [
                models.PaperTopic(
                    paper_id=db_paper.id,
                    topic_id=t.topic_id
                )
                for t in paper_data.topics
            ]
            db.add_all(db_topics)

        # Tạo phiên bản đầu tiên của bài báo
        db_version = models.PaperVersion(
            paper_id=db_paper.id,
            version_number=1,
            file_url=file_url,
            is_camera_ready=False,
            # Nếu chế độ Blind Mode bật, file này cũng phải được đánh dấu ẩn danh
            is_anonymous=paper_data.is_blind_mode
        )
        db.add(db_version)

        # Lưu toàn bộ thay đổi
        db.commit()
        db.refresh(db_paper)
        return db_paper

    except Exception as e:
        db.rollback()
        print(f"Error creating paper: {str(e)}")
        raise e
    

# Nghiệp vụ lấy danh sách bài báo của tác giả
def get_papers_by_author(
    db: Session,
    submitter_id: int
) -> list[models.Paper]:return (
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

# Nghiệp vụ lấy chi tiết bài báo
def get_author_paper_detail(
    db: Session,
    paper_id: int,
    submitter_id: int
) -> models.Paper:
    
    # Tìm bài báo theo id
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

# Kiểm tra chủ sở hữu
def is_author_owner(
    db: Session,
    paper_id: int,
    submitter_id: int
) -> bool:
  
    count = (
        db.query(models.Paper)
        .filter(
            models.Paper.id == paper_id,
            models.Paper.submitter_id == submitter_id
        )
        .count()
    )
    return count > 0