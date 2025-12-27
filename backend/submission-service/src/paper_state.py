from abc import ABC, abstractmethod
from fastapi import HTTPException

# Interface State
class PaperState(ABC):
    def __init__(self, paper):
        self.paper = paper

    @abstractmethod
    def submit(self):
        """Logic khi nộp/cập nhật bài"""
        pass

    @abstractmethod
    def withdraw(self):
        """Logic khi rút bài"""
        pass

# Concrete State: SUBMITTED
class SubmittedState(PaperState):
    def submit(self):
        # Ở trạng thái này, được phép cập nhật bài (upload version mới)
        return "Allowed to update paper."

    def withdraw(self):
        # Được phép rút bài
        self.paper.status = "WITHDRAWN"
        return "Paper has been withdrawn."

# Concrete State: UNDER_REVIEW
class UnderReviewState(PaperState):
    def submit(self):
        # Đang chấm thì không được sửa
        raise HTTPException(status_code=400, detail="Cannot edit paper while under review.")

    def withdraw(self):
        # Không được rút ngang
        raise HTTPException(status_code=400, detail="Cannot withdraw during review process.")

# Factory để lấy State hiện tại từ Model
def get_paper_state(paper) -> PaperState:
    if paper.status == "SUBMITTED":
        return SubmittedState(paper)
    elif paper.status == "UNDER_REVIEW":
        return UnderReviewState(paper)
    # Mặc định
    return SubmittedState(paper)