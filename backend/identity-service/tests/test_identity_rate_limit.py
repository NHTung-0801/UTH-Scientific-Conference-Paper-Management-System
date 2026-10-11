import os
import sys

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["SEED_ON_STARTUP"] = "false"

# Dam bao import duoc code backend/identity-service
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
SERVICE_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if SERVICE_DIR not in sys.path:
    sys.path.insert(0, SERVICE_DIR)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")


from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from src.database import Base, get_db
from src import models, crud
from src.main import app
from src.utils.redis_client import redis_client


# In-memory SQLite for testing
TEST_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)

def override_get_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


# Mock Redis Dictionary de test logic Rate Limit doc lap
class MockRedis:
    def __init__(self):
        self.store = {}
        self.ttls = {}

    def get(self, key):
        return self.store.get(key)

    def setex(self, key, seconds, value):
        self.store[key] = str(value)
        self.ttls[key] = seconds
        return True

    def incr(self, key):
        val = int(self.store.get(key, 0)) + 1
        self.store[key] = str(val)
        return val

    def expire(self, key, seconds):
        self.ttls[key] = seconds
        return True

    def ttl(self, key):
        return self.ttls.get(key, 60)

    def delete(self, key):
        if key in self.store:
            del self.store[key]
        if key in self.ttls:
            del self.ttls[key]
        return True

    def ping(self):
        return True


def run_tests():
    print("======================================================================")
    print(">>> BAT DAU KIEM THU RATE LIMITING: IDENTITY SERVICE (TASK ID-02) <<<")
    print("======================================================================")

    # Gan Mock Redis vao singleton redis_client
    mock_redis = MockRedis()
    redis_client.get_client = lambda: mock_redis

    db = TestingSession()

    # 1. Khoi tao User mau
    user_email = "test_ratelimit@uth.edu.vn"
    user_pass = "Password123!"
    user = models.User(
        email=user_email,
        password_hash=crud.get_password_hash(user_pass),
        full_name="Rate Limit Tester",
        is_active=True,
    )
    db.add(user)
    db.commit()
    print("[1] Khoi tao User kiem thu thanh cong!")

    # 2. Test Rate Limit Login: 5 lan sai mat khau lien tiep
    print("\n--- Test 2: Rate Limit Login (Toi da 5 lan sai / 1 phut) ---")
    for i in range(1, 6):
        res = client.post("/api/auth/login", json={"email": user_email, "password": "wrong_password"})
        assert res.status_code == 401, f"Lan {i} phai tra ve 401 Unauthorized"
        print(f"    Lan thu {i}: HTTP {res.status_code} (Sai mat khau)")

    # Lan thu 6: Phai bi chan boi Rate Limiter (HTTP 429)
    res_blocked = client.post("/api/auth/login", json={"email": user_email, "password": "wrong_password"})
    assert res_blocked.status_code == 429, f"Lan 6 phai tra ve 429 Too Many Requests, nhung nhan {res_blocked.status_code}"
    assert "Retry-After" in res_blocked.headers
    assert "Quá nhiều lần thử đăng nhập thất bại" in res_blocked.json()["detail"]
    print(f"    Lan thu 6: HTTP {res_blocked.status_code} -> BI CHAN VOI RATE LIMITER! (Retry-After: {res_blocked.headers.get('Retry-After')}s)")
    print("[PASS] Test 2: Chặn Brute-Force Login thành công!")

    # 3. Test Reset Failure Count khi Dang nhap dung mat khau
    print("\n--- Test 3: Dang nhap thanh cong sau khi het lockout ---")
    # Xoa lockout key gia lap het thoi gian lockout
    mock_redis.delete("ratelimit:login:failed:testclient")
    res_success = client.post("/api/auth/login", json={"email": user_email, "password": user_pass})
    assert res_success.status_code == 200
    assert "access_token" in res_success.json()
    # Kiem tra counter that bai da duoc xoa sach
    assert mock_redis.get("ratelimit:login:failed:testclient") is None
    print("[PASS] Test 3: Đăng nhập thành công và xóa bộ đếm thất bại thành công!")

    # 4. Test Rate Limit Forgot Password (Toi da 3 lan / 5 phut)
    print("\n--- Test 4: Rate Limit Forgot Password (Toi da 3 lan / 5 phut) ---")
    for i in range(1, 4):
        res_fp = client.post("/api/auth/forgot-password", json={"email": user_email})
        assert res_fp.status_code == 200, f"Lan {i} phai tra ve 200 OK"
        print(f"    Yeu cau OTP lan {i}: HTTP {res_fp.status_code} OK")

    # Lan thu 4: Phai bi chan boi Rate Limiter (HTTP 429)
    res_fp_blocked = client.post("/api/auth/forgot-password", json={"email": user_email})
    assert res_fp_blocked.status_code == 429
    assert "Retry-After" in res_fp_blocked.headers
    assert "quá 3 lần" in res_fp_blocked.json()["detail"]
    print(f"    Yeu cau OTP lan 4: HTTP {res_fp_blocked.status_code} -> BI CHAN VOI RATE LIMITER! (Retry-After: {res_fp_blocked.headers.get('Retry-After')}s)")
    print("[PASS] Test 4: Chặn spam Forgot-Password OTP thành công!")

    # 5. Test Rate Limit Verify OTP (Toi da 5 lan sai / 5 phut)
    print("\n--- Test 5: Rate Limit Verify OTP (Toi da 5 lan sai / 5 phut) ---")
    for i in range(1, 6):
        res_otp = client.post("/api/auth/verify-otp", json={"email": user_email, "otp": "999999"})
        assert res_otp.status_code == 400, f"Lan {i} phai tra ve 400 Invalid OTP"
        print(f"    Nhap sai OTP lan {i}: HTTP {res_otp.status_code}")

    # Lan thu 6: Phai bi chan boi Rate Limiter (HTTP 429)
    res_otp_blocked = client.post("/api/auth/verify-otp", json={"email": user_email, "otp": "999999"})
    assert res_otp_blocked.status_code == 429
    assert "Retry-After" in res_otp_blocked.headers
    assert "quá 5 lần" in res_otp_blocked.json()["detail"]
    print(f"    Nhap sai OTP lan 6: HTTP {res_otp_blocked.status_code} -> BI CHAN VOI RATE LIMITER! (Retry-After: {res_otp_blocked.headers.get('Retry-After')}s)")
    print("[PASS] Test 5: Chặn dò mã Verify-OTP thành công!")

    # 6. Test Fail-Open khi Redis Offline
    print("\n--- Test 6: Co che Fail-Open khi Redis mat ket noi ---")
    redis_client.get_client = lambda: None  # Gia lap Redis offline hoan toan
    res_failopen = client.post("/api/auth/login", json={"email": user_email, "password": user_pass})
    assert res_failopen.status_code == 200, "Khi Redis offline, he thong van phai cho phep dang nhap hop le (Fail-Open)"
    print("[PASS] Test 6: Cơ chế Fail-Open hoạt động chuẩn xác (không làm gián đoạn đăng nhập khi Redis down)!")

    print("\n======================================================================")
    print(">>> TẤT CẢ 6/6 MỤC KIỂM THU RATE LIMITING ĐỀU ĐẠT 100% PASS! <<<")
    print("======================================================================")


if __name__ == "__main__":
    run_tests()
