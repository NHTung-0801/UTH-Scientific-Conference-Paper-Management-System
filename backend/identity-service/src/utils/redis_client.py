import os
import logging
from typing import Optional
import redis

from src.config import settings

logger = logging.getLogger(__name__)


class RedisClient:
    """
    Redis Client hỗ trợ kết nối an toàn với cơ chế Fail-Open:
    Nếu Redis gặp sự cố hoặc mất kết nối, hệ thống vẫn hoạt động mà không bị crash request.
    """

    def __init__(self, redis_url: Optional[str] = None):
        self.redis_url = redis_url or os.getenv("REDIS_URL", settings.REDIS_URL)
        self._client: Optional[redis.Redis] = None

    def get_client(self) -> Optional[redis.Redis]:
        if self._client is None:
            try:
                self._client = redis.from_url(
                    self.redis_url,
                    decode_responses=True,
                    socket_timeout=1.0,
                    socket_connect_timeout=1.0,
                )
            except Exception as e:
                logger.warning(f"[Redis] Khong the khoi tao connection pool toi {self.redis_url}: {e}")
                return None
        return self._client

    def is_connected(self) -> bool:
        client = self.get_client()
        if not client:
            return False
        try:
            return bool(client.ping())
        except Exception:
            return False

    def get(self, key: str) -> Optional[str]:
        client = self.get_client()
        if not client:
            return None
        try:
            return client.get(key)
        except Exception as e:
            logger.warning(f"[Redis] Loi doc key '{key}': {e}")
            return None

    def setex(self, key: str, seconds: int, value: str) -> bool:
        client = self.get_client()
        if not client:
            return False
        try:
            return bool(client.setex(key, seconds, value))
        except Exception as e:
            logger.warning(f"[Redis] Loi ghi key '{key}' TTL {seconds}s: {e}")
            return False

    def incr_with_expiry(self, key: str, window_seconds: int) -> int:
        """
        Tang bien dem atomic cho Rate Limiting:
        - Neu key chua ton tai hoac vua duoc tao (count == 1), dat TTL bang window_seconds.
        - Neu Redis offline, tra ve 1 (fail-open).
        """
        client = self.get_client()
        if not client:
            return 1
        try:
            count = client.incr(key)
            if count == 1:
                client.expire(key, window_seconds)
            return count
        except Exception as e:
            logger.warning(f"[Redis] Loi tang counter key '{key}': {e}")
            return 1

    def get_ttl(self, key: str) -> int:
        client = self.get_client()
        if not client:
            return 0
        try:
            ttl = client.ttl(key)
            return max(ttl, 0)
        except Exception:
            return 0

    def delete(self, key: str) -> bool:
        client = self.get_client()
        if not client:
            return False
        try:
            return bool(client.delete(key))
        except Exception as e:
            logger.warning(f"[Redis] Loi xoa key '{key}': {e}")
            return False


# Singleton instance
redis_client = RedisClient()
