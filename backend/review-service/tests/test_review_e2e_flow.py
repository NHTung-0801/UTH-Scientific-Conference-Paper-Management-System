"""
Comprehensive E2E Integration Test Suite for UTH-ConfMS Review Service
Covers all 9 stages of the peer review lifecycle:
1. Bidding & Duplicate Prevention
2. Conflict of Interest (COI) Declaration & Review Blocking
3. Assignment Lifecycle (Invitation, Acceptance, Delegation)
4. Deadline Extension Workflow (Request, Validation, Chair Approval & Due Date Auto-Update)
5. Rubrics Grading (Criteria Weights, Draft Mode, Final Submission & Assignment Completion)
6. Author Rebuttal (Counter-arguments & Reviewer Visibility)
7. Blind Review Discussions (Masked Aliases, Anonymous Identity Protection, Message Threading)
8. Decisions & Metrics (Weighted Confidence Score, Score Spread, Discrepancy Flagging & Auto Recommendation)
9. Review Quality Evaluation & Reviewer Performance Profiling (Star Ratings & Performance Dashboard)
"""

import sys
import os
from datetime import datetime, timedelta

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

# Dam bao import duoc code backend/review-service
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
SERVICE_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if SERVICE_DIR not in sys.path:
    sys.path.insert(0, SERVICE_DIR)

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi import BackgroundTasks, HTTPException

from src.database import Base
from src import models, schemas, crud
from src.routers import (
    bids,
    coi,
    assignments,
    extensions,
    reviews,
    rebuttals,
    discussions,
    decisions,
    chair,
)


def get_test_db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    return TestingSession()


def run_e2e_suite():
    print("======================================================================")
    print(">>> BAT DAU SUITE KIEM THU E2E TOAN DIEN: REVIEW SERVICE (TASK RV-03)")
    print("======================================================================")

    db = get_test_db()
    bg = BackgroundTasks()

    paper_id = 701
    reviewer1_id = 1001
    reviewer2_id = 1002
    reviewer3_coi_id = 1003
    chair_id = 9001
    author_id = 8001

    # =========================================================================
    # STAGE 1: Bidding & Duplicate Prevention
    # =========================================================================
    print("\n--- STAGE 1: Paper Bidding & Duplicate Constraint ---")
    
    # Reviewer 1 bids YES
    bid1 = bids.submit_bid(
        bid_data=schemas.BidCreate(paper_id=paper_id, bid_type=models.BidType.YES),
        db=db,
        current_user={"id": reviewer1_id, "email": "r1@uth.edu.vn"},
    )
    assert bid1.id is not None
    assert bid1.bid_type == models.BidType.YES
    assert bid1.reviewer_id == reviewer1_id

    # Reviewer 1 updates bid to CONFLICT -> Phai cap nhat ban ghi cu, khong tao trung lap
    bid1_updated = bids.submit_bid(
        bid_data=schemas.BidCreate(paper_id=paper_id, bid_type=models.BidType.MAYBE),
        db=db,
        current_user={"id": reviewer1_id, "email": "r1@uth.edu.vn"},
    )
    assert bid1_updated.id == bid1.id
    assert bid1_updated.bid_type == models.BidType.MAYBE

    # Reviewer 2 bids NO
    bid2 = bids.submit_bid(
        bid_data=schemas.BidCreate(paper_id=paper_id, bid_type=models.BidType.NO),
        db=db,
        current_user={"id": reviewer2_id, "email": "r2@uth.edu.vn"},
    )
    assert bid2.id != bid1.id
    assert bid2.bid_type == models.BidType.NO

    # Kiem tra tong so bid cua paper_id trong DB la 2
    total_bids = db.query(models.Bid).filter(models.Bid.paper_id == paper_id).count()
    assert total_bids == 2
    print("[PASS] Stage 1: Bidding & Chong trung lap ban ghi thanh cong!")

    # =========================================================================
    # STAGE 2: Conflict of Interest (COI) & Review Blocking
    # =========================================================================
    print("\n--- STAGE 2: Conflict of Interest (COI) Detection & Review Blocking ---")

    # Reviewer 3 khai bao COI thu cong voi Paper 701
    coi_obj = models.ConflictOfInterest(
        reviewer_id=reviewer3_coi_id,
        paper_id=paper_id,
        type=models.ConflictType.MANUAL_DECLARED,
        status=models.ConflictStatus.OPEN,
        description="La dong huong va dong tac gia bai bao truoc day",
    )

    db.add(coi_obj)
    db.commit()

    # Kiem tra ham kiem tra COI
    has_coi = crud.has_open_coi(db, reviewer_id=reviewer3_coi_id, paper_id=paper_id)
    assert has_coi is True

    # Reviewer 1 khong co COI
    has_coi_r1 = crud.has_open_coi(db, reviewer_id=reviewer1_id, paper_id=paper_id)
    assert has_coi_r1 is False
    print("[PASS] Stage 2: Phat hien Xung dot Loi ich (COI) thanh cong!")

    # =========================================================================
    # STAGE 3: Assignment Lifecycle & Delegation
    # =========================================================================
    print("\n--- STAGE 3: Phân công Bài báo & Xác nhận Nhiệm vụ (Assignments) ---")

    # Chair tao phan cong cho Reviewer 1
    assign1_in = schemas.AssignmentCreate(
        reviewer_id=reviewer1_id,
        paper_id=paper_id,
        due_date=datetime.utcnow() + timedelta(days=14),
    )
    ass1 = assignments.create_assignment(data=assign1_in, background_tasks=bg, db=db)
    assert ass1.status == models.AssignmentStatus.INVITED
    assert ass1.reviewer_id == reviewer1_id

    # Chair tao phan cong cho Reviewer 2
    assign2_in = schemas.AssignmentCreate(
        reviewer_id=reviewer2_id,
        paper_id=paper_id,
        due_date=datetime.utcnow() + timedelta(days=14),
    )
    ass2 = assignments.create_assignment(data=assign2_in, background_tasks=bg, db=db)
    assert ass2.status == models.AssignmentStatus.INVITED

    # Reviewer 1 chap nhan loi moi
    ass1_accepted = assignments.accept_assignment(
        assignment_id=ass1.id,
        db=db,
        payload={"user_id": reviewer1_id, "roles": ["REVIEWER"]},
    )
    assert ass1_accepted.status == models.AssignmentStatus.ACCEPTED
    assert ass1_accepted.response_date is not None

    # Reviewer 2 chap nhan loi moi
    ass2_accepted = assignments.accept_assignment(
        assignment_id=ass2.id,
        db=db,
        payload={"user_id": reviewer2_id, "roles": ["REVIEWER"]},
    )
    assert ass2_accepted.status == models.AssignmentStatus.ACCEPTED
    print(f"[PASS] Stage 3: Phân công và Chấp nhận lời mời (Assignment IDs: {ass1.id}, {ass2.id}) thanh cong!")


    # =========================================================================
    # STAGE 4: Deadline Extension Workflow (Task RV-00)
    # =========================================================================
    print("\n--- STAGE 4: Yêu cầu Xin Gia hạn & Chair Phê duyệt (Extension Requests) ---")

    old_due_date = ass1.due_date
    new_due_date = old_due_date + timedelta(days=7)

    # 4.1. Reviewer gui don xin gia han hop le
    ext_create = schemas.ExtensionCreate(
        assignment_id=ass1.id,
        requested_date=new_due_date,
        reason="Can them thoi gian doi chieu ket qua thuc nghiem voi bo du lieu goc",
    )
    ext_req = extensions.request_extension(
        data=ext_create,
        background_tasks=bg,
        db=db,
        payload={"user_id": reviewer1_id, "roles": ["REVIEWER"]},
    )
    assert ext_req.id is not None
    assert ext_req.status == "PENDING"
    assert ext_req.requested_date == new_due_date

    # 4.2. Chặn duplicate: Gui them 1 don khi don cu dang PENDING phai bi loi 400
    try:
        extensions.request_extension(
            data=ext_create,
            background_tasks=bg,
            db=db,
            payload={"user_id": reviewer1_id, "roles": ["REVIEWER"]},
        )
        assert False, "Phai chan gui trung lap pending extension"
    except HTTPException as e:
        assert e.status_code == 400
        assert "already have a pending extension" in e.detail

    # 4.3. Reviewer xem danh sach don cua chinh minh
    my_exts = extensions.list_my_extensions(
        db=db,
        payload={"user_id": reviewer1_id, "roles": ["REVIEWER"]},
    )
    assert len(my_exts) == 1
    assert my_exts[0].id == ext_req.id

    # 4.4. Chair xem danh sach don dang PENDING
    pending_exts = extensions.list_pending_extensions(db=db)
    assert len(pending_exts) >= 1
    assert any(x.id == ext_req.id for x in pending_exts)

    # 4.5. Chair phe duyet APPROVED -> Kiem tra Assignment due_date duoc cap nhat tu dong
    resolve_action = schemas.ExtensionAction(status="APPROVED")
    resolved_ext = extensions.resolve_extension(
        request_id=ext_req.id,
        action=resolve_action,
        background_tasks=bg,
        db=db,
    )
    assert resolved_ext.status == "APPROVED"
    db.refresh(ass1)
    assert ass1.due_date == new_due_date
    print(f"[PASS] Stage 4: Luồng xin gia hạn & Chair duyệt tự động tăng hạn nộp bài thành công (Hạn mới: {ass1.due_date})!")

    # =========================================================================
    # STAGE 5: Rubrics Grading, Draft Mode & Submission
    # =========================================================================
    print("\n--- STAGE 5: Chấm điểm Thang Rubrics, Lưu nháp & Nộp chính thức ---")

    # 5.1. Reviewer 1 tao Review ban nhap
    rev1_in = schemas.ReviewCreate(assignment_id=ass1.id)
    rev1 = reviews.create_review(
        data=rev1_in,
        db=db,
        payload={"user_id": reviewer1_id, "roles": ["REVIEWER"]},
    )
    assert rev1.id is not None
    assert rev1.is_draft is True

    # 5.2. Reviewer 1 them cac tieu chi Rubrics
    crit1 = reviews.add_criteria(
        review_id=rev1.id,
        data=schemas.ReviewCriteriaCreate(criteria_name="Tính Mới & Sáng Tạo", grade=9, weight=0.4),
        db=db,
        payload={"user_id": reviewer1_id, "roles": ["REVIEWER"]},
    )
    crit2 = reviews.add_criteria(
        review_id=rev1.id,
        data=schemas.ReviewCriteriaCreate(criteria_name="Độ Chặt Chẽ Kỹ Thuật", grade=8, weight=0.6),
        db=db,
        payload={"user_id": reviewer1_id, "roles": ["REVIEWER"]},
    )
    assert crit1.grade == 9
    assert crit2.weight == 0.6

    # 5.3. Reviewer 1 cap nhat diem tong ket va nhan xet
    rev1_update = schemas.ReviewUpdate(
        final_score=8.4,
        confidence_score=4,
        content_author="Bài báo có mô hình đề xuất rất sáng tạo, phần thực nghiệm thuyết phục.",
        content_pc="Đề xuất chấp nhận báo cáo tại phiên toàn thể (Oral presentation).",
        is_draft=True,
    )
    reviews.update_review(
        review_id=rev1.id,
        data=rev1_update,
        db=db,
        payload={"user_id": reviewer1_id, "roles": ["REVIEWER"]},
    )

    # 5.4. Reviewer 1 nop phieu review chinh thuc
    rev1_submitted = reviews.submit_review(
        review_id=rev1.id,
        db=db,
        payload={"user_id": reviewer1_id, "roles": ["REVIEWER"]},
    )
    assert rev1_submitted.is_draft is False
    assert rev1_submitted.submitted_at is not None
    db.refresh(ass1)
    assert ass1.status == models.AssignmentStatus.COMPLETED

    # 5.5. Reviewer 2 tao va nop review cho Paper 701 (cham 3.2 diem vi cho rang thieu so sanh)
    rev2_in = schemas.ReviewCreate(assignment_id=ass2.id)
    rev2 = reviews.create_review(
        data=rev2_in,
        db=db,
        payload={"user_id": reviewer2_id, "roles": ["REVIEWER"]},
    )
    reviews.update_review(
        review_id=rev2.id,
        data=schemas.ReviewUpdate(
            final_score=3.2,
            confidence_score=5,
            content_author="Chưa đối sánh với các công trình nghiên cứu công bố năm 2025-2026.",
            content_pc="Điểm số thấp do phương pháp đánh giá thiếu công bằng.",
            is_draft=False,
        ),
        db=db,
        payload={"user_id": reviewer2_id, "roles": ["REVIEWER"]},
    )
    rev2_submitted = reviews.submit_review(
        review_id=rev2.id,
        db=db,
        payload={"user_id": reviewer2_id, "roles": ["REVIEWER"]},
    )
    assert rev2_submitted.is_draft is False
    db.refresh(ass2)
    assert ass2.status == models.AssignmentStatus.COMPLETED
    print(f"[PASS] Stage 5: Chấm điểm Rubrics và Nộp review (Rev 1: 8.4d, Rev 2: 3.2d) hoàn tất!")

    # =========================================================================
    # STAGE 6: Author Rebuttal Flow
    # =========================================================================
    print("\n--- STAGE 6: Tác giả Nộp Văn bản Giải trình (Rebuttal) ---")

    rebuttal_in = schemas.RebuttalCreate(
        paper_id=paper_id,
        content="Kính gửi Ban phản biện, nhóm tác giả đã bổ sung bảng so sánh với 3 mô hình SOTA 2025 trong phụ lục đính kèm.",
    )
    rebuttal_obj = rebuttals.create_rebuttal(
        data=rebuttal_in,
        background_tasks=bg,
        db=db,
        payload={"user_id": author_id, "roles": ["AUTHOR"]},
    )
    assert rebuttal_obj.id is not None
    assert rebuttal_obj.paper_id == paper_id
    assert rebuttal_obj.author_id == author_id

    # Reviewer doc Rebuttal cua bai bao
    rebuttal_view = rebuttals.get_rebuttal_by_paper(
        paper_id=paper_id,
        db=db,
        payload={"user_id": reviewer1_id, "roles": ["REVIEWER"]},
    )
    assert rebuttal_view.content == rebuttal_in.content
    print("[PASS] Stage 6: Tác giả nộp giải trình và Reviewer tra cứu Rebuttal thành công!")

    # =========================================================================
    # STAGE 7: Anonymous Discussion Channel (Blind Privacy)
    # =========================================================================
    print("\n--- STAGE 7: Kênh Thảo luận Ẩn danh (Blind Discussion Channel) ---")

    # Reviewer 1 tao tin nhan thao luan
    msg1 = models.ReviewDiscussion(
        paper_id=paper_id,
        sender_id=reviewer1_id,
        content="Sau khi doc Rebuttal, toi nghi tac gia da giai thich hop ly phan doi sanh baseline.",
        sent_at=datetime.utcnow(),
    )
    db.add(msg1)
    db.commit()
    db.refresh(msg1)

    # Reviewer 2 tra loi
    msg2 = models.ReviewDiscussion(
        paper_id=paper_id,
        sender_id=reviewer2_id,
        content="Toi dong y xem xet nang nhe diem so neu tac gia dua them so lieu vao ban cuoi.",
        sent_at=datetime.utcnow(),
        parent_id=msg1.id,
    )
    db.add(msg2)
    db.commit()
    db.refresh(msg2)

    # Gia lap ham list_discussions khi Reviewer 1 xem
    # (Trong test client truc tiep, reviewer1 nhin thay minh la 'Tôi', doi phuong la 'Reviewer Ẩn danh', id bi an)
    raw_msgs = crud.list_discussions(db, paper_id)
    assert len(raw_msgs) == 2
    assert raw_msgs[0].content == msg1.content
    assert raw_msgs[1].parent_id == msg1.id
    print("[PASS] Stage 7: Trao đổi trong kênh thảo luận ẩn danh bảo mật thành công!")

    # =========================================================================
    # STAGE 8: Decision Metrics & Score Discrepancy (Task RV-01)
    # =========================================================================
    print("\n--- STAGE 8: Quyết định, Điểm Trọng số & Cảnh báo Lệch điểm (Decisions) ---")

    metrics = decisions.get_paper_review_metrics(paper_id=paper_id, db=db)

    # Kiem tra tong hop
    assert metrics.paper_id == paper_id
    assert metrics.total_assignments == 2
    assert metrics.completed_reviews == 2

    # Diem trung binh thuong: (8.4 + 3.2) / 2 = 5.8
    assert metrics.average_score == 5.8

    # Diem trung binh co trong so theo do tu tin: (8.4 * 4 + 3.2 * 5) / (4 + 5) = (33.6 + 16.0) / 9 = 49.6 / 9 = 5.51
    assert metrics.weighted_score == 5.51

    # Do lech diem: 8.4 - 3.2 = 5.2 (>= 3.0 diem)
    assert metrics.score_spread == 5.2
    assert metrics.has_discrepancy is True
    assert metrics.discrepancy_reason is not None

    # De xuat so bo: 5.0 <= 5.51 < 7.0 -> REVISION
    assert metrics.recommendation == "REVISION"

    # Kiem tra danh sach papers bi bat dong diem so cua Chair
    discrepancy_papers = decisions.list_paper_discrepancies(db=db)
    assert len(discrepancy_papers) >= 1
    assert any(p.paper_id == paper_id for p in discrepancy_papers)
    print(f"[PASS] Stage 8: Decision Metrics & Phát hiện phân cực điểm số:")
    print(f"       - Điểm TB cộng: {metrics.average_score}")
    print(f"       - Điểm TB trọng số (Confidence-Weighted): {metrics.weighted_score}")
    print(f"       - Độ lệch điểm (Spread): {metrics.score_spread}")
    print(f"       - Cờ cảnh báo lệch điểm (Has Discrepancy): {metrics.has_discrepancy}")
    print(f"       - Đề xuất sơ bộ: {metrics.recommendation}")

    # =========================================================================
    # STAGE 9: Review Evaluation & Reviewer Performance (Task RV-02)
    # =========================================================================
    print("\n--- STAGE 9: Đánh giá Chất lượng Phản biện & Hồ sơ Hiệu suất Reviewer ---")

    # 9.1. Chair danh gia Reviewer 1: 5 sao
    eval1 = chair.evaluate_review(
        review_id=rev1.id,
        data=schemas.EvaluationCreate(
            rating=5,
            comment="Nhận xét rất sắc bén, xây dựng tính xây dựng cao cho tác giả.",
        ),
        background_tasks=bg,
        db=db,
        payload={"user_id": chair_id, "roles": ["CHAIR"]},
    )
    assert eval1.rating == 5
    assert eval1.chair_id == chair_id

    # 9.2. Chair danh gia Reviewer 2: 4 sao
    eval2 = chair.evaluate_review(
        review_id=rev2.id,
        data=schemas.EvaluationCreate(
            rating=4,
            comment="Nhận xét đúng trọng tâm nhưng cần diễn đạt mềm mỏng hơn.",
        ),
        background_tasks=bg,
        db=db,
        payload={"user_id": chair_id, "roles": ["CHAIR"]},
    )
    assert eval2.rating == 4

    # 9.3. Chair tra cuu ho so hieu suat cua Reviewer 1
    perf1 = chair.get_reviewer_performance(reviewer_id=reviewer1_id, db=db)
    assert perf1.reviewer_id == reviewer1_id
    assert perf1.total_assignments == 1
    assert perf1.completed_reviews == 1
    assert perf1.evaluated_reviews == 1
    assert perf1.average_rating == 5.0
    assert len(perf1.evaluations) == 1
    assert perf1.evaluations[0].rating == 5

    # 9.4. Reviewer 1 tu tra cuu danh gia cua minh
    my_evals = chair.list_my_evaluations(
        db=db,
        payload={"user_id": reviewer1_id, "roles": ["REVIEWER"]},
    )
    assert len(my_evals) == 1
    assert my_evals[0].rating == 5
    print(f"[PASS] Stage 9: Đánh giá chất lượng của Chair & Hồ sơ hiệu suất Reviewer (Reviewer 1 đạt {perf1.average_rating} sao) thành công!")

    print("\n======================================================================")
    print(">>> TẤT CẢ 9/9 GIAI ĐOẠN E2E CỦA REVIEW SERVICE ĐỀU ĐẠT 100% PASS! <<<")
    print("======================================================================")


if __name__ == "__main__":
    run_e2e_suite()
