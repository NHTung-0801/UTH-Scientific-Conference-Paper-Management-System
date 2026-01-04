class PaperNotFoundError(Exception):
    """Lỗi khi không tìm thấy bài báo trong DB"""
    pass

class NotAuthorizedError(Exception):
    """Lỗi khi user cố truy cập bài báo không phải của mình"""
    pass

class StateTransitionError(Exception):
    """Lỗi khi cố chuyển trạng thái bài báo không hợp lệ (ví dụ: đã Duyệt rồi lại nộp lại)"""
    pass

