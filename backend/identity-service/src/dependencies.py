# src/dependencies.py
from fastapi import Depends, HTTPException, status, Request
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
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 1. Kiểm tra Token Blacklist theo mã jti (đã bị thu hồi khi đăng xuất)
    jti = payload.get("jti")
    if jti:
        from src.utils.redis_client import redis_client
        if redis_client.get(f"blacklist:jti:{jti}"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has been revoked",
                headers={"WWW-Authenticate": "Bearer"},
            )

    # 2. Kiểm tra Session Revocation khi User đổi mật khẩu hoặc đăng xuất toàn bộ thiết bị
    user_id = payload.get("user_id") or payload.get("id")
    if user_id:
        from src.utils.redis_client import redis_client
        pwd_change_ts = redis_client.get(f"user:pwd_change:{user_id}")
        if pwd_change_ts:
            try:
                min_iat = int(pwd_change_ts)
                iat = int(payload.get("iat", 0))
                if iat < min_iat:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Session expired due to password change or global logout. Please log in again.",
                        headers={"WWW-Authenticate": "Bearer"},
                    )
            except (ValueError, TypeError):
                pass

    return payload

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


# =========================================================
# RATE LIMITING HELPERS
# =========================================================

def get_client_ip(request: Request) -> str:
    """
    Lấy địa chỉ IP thực của client từ các header Nginx Reverse Proxy (X-Forwarded-For hoặc X-Real-IP).
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "127.0.0.1"


def check_rate_limit(key: str, limit: int, window_seconds: int, error_message: str):
    """
    Kiểm tra và tăng biến đếm Rate Limiting qua Redis.
    Nếu vượt quá ngưỡng limit, ném lỗi HTTP 429 Too Many Requests kèm Retry-After header.
    """
    from src.utils.redis_client import redis_client

    current_count = redis_client.incr_with_expiry(key, window_seconds=window_seconds)
    if current_count > limit:
        ttl = redis_client.get_ttl(key) or window_seconds
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"{error_message} Vui lòng thử lại sau {ttl} giây.",
            headers={"Retry-After": str(ttl)},
        )
