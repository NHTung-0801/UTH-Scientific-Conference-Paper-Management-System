# src/dependencies.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Dict, Any, List

from src.auth import decode_token 

# Cấu hình HTTPBearer không tự động bắn lỗi HTML mặc định để ta kiểm soát trả về JSON chuẩn
security = HTTPBearer(auto_error=False)

def get_current_payload(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """
    Dependency trích xuất token từ Header 'Authorization: Bearer <token>',
    giải mã và trả về dictionary payload (chứa sub, user_id, id, roles).
    Nếu thiếu token hoặc token sai/hết hạn, trả về HTTP 401 Unauthorized.
    """
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = decode_token(credentials.credentials)
        return payload
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

def require_user(payload: Dict[str, Any] = Depends(get_current_payload)) -> Dict[str, Any]:
    """
    Dependency đảm bảo request đến từ một người dùng đã đăng nhập hợp lệ.
    """
    return payload

def require_roles(*allowed_roles: str):
    """
    Factory dependency kiểm tra quyền (RBAC):
    Chỉ cho phép người dùng có ít nhất một trong các vai trò được truyền vào.
    Ví dụ: Depends(require_roles("ADMIN", "CHAIR"))
    """
    normalized_allowed = {r.strip().upper() for r in allowed_roles}

    def _guard(payload: Dict[str, Any] = Depends(require_user)) -> Dict[str, Any]:
        roles = payload.get("roles") or []
        if isinstance(roles, str):
            roles = [roles]
        user_roles = {str(r).strip().upper() for r in roles}

        if normalized_allowed and user_roles.isdisjoint(normalized_allowed):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: Requires one of {list(normalized_allowed)}"
            )
        return payload

    return _guard

# Các Guard phân quyền phổ biến dùng cho toàn bộ router
require_admin = require_roles("ADMIN")
require_admin_or_chair = require_roles("ADMIN", "CHAIR")