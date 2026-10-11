import os
import sys
import time

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["SEED_ON_STARTUP"] = "false"

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


# In-memory SQLite with StaticPool so all threads/sessions share schema
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


# Mock Redis Dictionary for testing Blacklist & Revocation
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
    print("==========================================================================")
    print(">>> BAT DAU KIEM THU TOKEN BLACKLIST & REVOCATION (TASK ID-03) <<<")
    print("==========================================================================")

    mock_redis = MockRedis()
    redis_client.get_client = lambda: mock_redis

    db = TestingSession()

    # Khoi tao Roles
    author_role = models.Role(role_name="AUTHOR")
    admin_role = models.Role(role_name="ADMIN")
    db.add(author_role)
    db.add(admin_role)
    db.commit()

    # Khoi tao User
    email = "test_blacklist@uth.edu.vn"
    initial_password = "Password123!"
    user = models.User(
        email=email,
        password_hash=crud.get_password_hash(initial_password),
        full_name="Blacklist Test User",
        is_active=True,
    )
    user.roles.append(author_role)
    db.add(user)
    db.commit()
    db.refresh(user)
    user_id = user.id
    print(f"[1] Khoi tao User kiem thu thanh cong (ID: {user_id}, Email: {email})")

    # -------------------------------------------------------------------------
    # Test 1: Dang nhap hop le & goi /api/users/me thanh cong
    # -------------------------------------------------------------------------
    print("\n--- Test 1: Dang nhap va truy van profile voi Access Token hop le ---")
    login_res = client.post("/api/auth/login", json={"email": email, "password": initial_password})
    assert login_res.status_code == 200
    token_1 = login_res.json()["access_token"]
    refresh_1 = login_res.json()["refresh_token"]

    headers_1 = {"Authorization": f"Bearer {token_1}"}
    me_res = client.get("/api/users/me", headers=headers_1)
    assert me_res.status_code == 200
    assert me_res.json()["email"] == email
    print(f"    Goi /api/users/me: HTTP {me_res.status_code} OK (Email: {me_res.json()['email']})")
    print("[PASS] Test 1: Access Token hoat dong dung ky vong!")

    # -------------------------------------------------------------------------
    # Test 2: Dang xuat (Single Logout) -> Access Token bi Blacklist
    # -------------------------------------------------------------------------
    print("\n--- Test 2: Dang xuat -> Dua Access Token vao Redis Blacklist ---")
    logout_res = client.post(
        "/api/auth/logout",
        json={"refresh_token": refresh_1, "all_devices": False},
        headers=headers_1
    )
    assert logout_res.status_code == 200
    print(f"    Goi /api/auth/logout: HTTP {logout_res.status_code} ({logout_res.json()['message']})")

    # Kiem tra Redis store xem co blacklist:jti:* khong
    blacklist_keys = [k for k in mock_redis.store.keys() if k.startswith("blacklist:jti:")]
    assert len(blacklist_keys) > 0, "Redis phai chua key blacklist:jti cho token da dang xuat!"
    print(f"    Redis Blacklist Key da tao: {blacklist_keys[0]}")

    # Thu dung lai token_1 de goi /api/users/me -> Phai bi tu choi HTTP 401
    me_revoked_res = client.get("/api/users/me", headers=headers_1)
    assert me_revoked_res.status_code == 401, f"Token da dang xuat phai bi 401, nhan {me_revoked_res.status_code}"
    assert "revoked" in me_revoked_res.json()["detail"].lower()
    print(f"    Dung lai Token cu goi /api/users/me: HTTP {me_revoked_res.status_code} ({me_revoked_res.json()['detail']})")
    print("[PASS] Test 2: Access Token bi chan ngay lap tuc sau khi dang xuat!")

    # -------------------------------------------------------------------------
    # Test 3: Doi mat khau -> Vo hieu hoa token cua tat ca cac thiet bi
    # -------------------------------------------------------------------------
    print("\n--- Test 3: Doi mat khau -> Vo hieu hoa token cua tat ca thiet bi ---")
    # Dang nhap tren 2 thiet bi khac nhau
    login_dev_a = client.post("/api/auth/login", json={"email": email, "password": initial_password})
    token_dev_a = login_dev_a.json()["access_token"]
    
    time.sleep(1) # Chenh lech timestamp iat
    login_dev_b = client.post("/api/auth/login", json={"email": email, "password": initial_password})
    token_dev_b = login_dev_b.json()["access_token"]

    # Ca 2 token deu hoat dong truoc khi doi mat khau
    assert client.get("/api/users/me", headers={"Authorization": f"Bearer {token_dev_a}"}).status_code == 200
    assert client.get("/api/users/me", headers={"Authorization": f"Bearer {token_dev_b}"}).status_code == 200
    print("    Ca 2 thiet bi A va B dang truy cap binh thuong.")

    # Thiet bi A goi doi mat khau
    new_password = "NewPassword456!"
    time.sleep(1) # Dam bao thoi diem doi mat khau > iat cua cac token cu
    change_res = client.post(
        "/api/auth/change-password",
        json={"old_password": initial_password, "new_password": new_password},
        headers={"Authorization": f"Bearer {token_dev_a}"}
    )
    assert change_res.status_code == 200
    print(f"    Thiet bi A doi mat khau thanh cong: HTTP {change_res.status_code}")

    # Kiem tra Redis co key user:pwd_change:{user_id}
    assert f"user:pwd_change:{user_id}" in mock_redis.store
    print(f"    Redis ghi nhan timestamp doi mat khau: {mock_redis.store[f'user:pwd_change:{user_id}']}")

    # Token Device A phai bi tu choi vi iat < pwd_change_ts
    res_a_after = client.get("/api/users/me", headers={"Authorization": f"Bearer {token_dev_a}"})
    assert res_a_after.status_code == 401
    assert "password change" in res_a_after.json()["detail"].lower()
    print(f"    Thiet bi A voi token cu: HTTP {res_a_after.status_code} ({res_a_after.json()['detail']})")

    # Token Device B cung phai bi tu choi
    res_b_after = client.get("/api/users/me", headers={"Authorization": f"Bearer {token_dev_b}"})
    assert res_b_after.status_code == 401
    assert "password change" in res_b_after.json()["detail"].lower()
    print(f"    Thiet bi B voi token cu: HTTP {res_b_after.status_code} ({res_b_after.json()['detail']})")

    # Dang nhap voi mat khau moi -> Token moi hoat dong binh thuong
    time.sleep(1) # iat cua token moi > timestamp doi mat khau
    login_new = client.post("/api/auth/login", json={"email": email, "password": new_password})
    assert login_new.status_code == 200
    token_new = login_new.json()["access_token"]
    res_new = client.get("/api/users/me", headers={"Authorization": f"Bearer {token_new}"})
    assert res_new.status_code == 200
    print(f"    Dang nhap voi mat khau moi -> Goi /api/users/me: HTTP {res_new.status_code} OK")
    print("[PASS] Test 3: Doi mat khau da vo hieu hoa toan bo token cu tren moi thiet bi!")

    # -------------------------------------------------------------------------
    # Test 4: Reset Password qua OTP -> Vo hieu hoa token cu
    # -------------------------------------------------------------------------
    print("\n--- Test 4: Reset Password qua OTP -> Vo hieu hoa token cu ---")
    active_token = token_new
    # Tao reset OTP
    user_in_db = db.query(models.User).filter(models.User.id == user_id).first()
    user_in_db.reset_token = "123456"
    from datetime import datetime, timedelta
    user_in_db.reset_token_expires_at = datetime.utcnow() + timedelta(minutes=15)
    db.commit()

    time.sleep(1)
    reset_pass = "ResetPassword789!"
    reset_res = client.post("/api/auth/reset-password", json={"token": "123456", "new_password": reset_pass})
    assert reset_res.status_code == 200
    print(f"    Reset mat khau qua OTP thanh cong: HTTP {reset_res.status_code}")

    # Token cu phai bi vo hieu hoa
    res_old_after_reset = client.get("/api/users/me", headers={"Authorization": f"Bearer {active_token}"})
    assert res_old_after_reset.status_code == 401
    print(f"    Token cu sau khi reset pass: HTTP {res_old_after_reset.status_code} (Bi tu choi thanh cong)")
    print("[PASS] Test 4: Reset mat khau qua OTP da vo hieu hoa token cu thanh cong!")

    # -------------------------------------------------------------------------
    # Test 5: Dang xuat tat ca thiet bi (all_devices = True)
    # -------------------------------------------------------------------------
    print("\n--- Test 5: Dang xuat tat ca thiet bi (all_devices = True) ---")
    time.sleep(1)
    login_all = client.post("/api/auth/login", json={"email": email, "password": reset_pass})
    token_all = login_all.json()["access_token"]
    assert client.get("/api/users/me", headers={"Authorization": f"Bearer {token_all}"}).status_code == 200

    time.sleep(1)
    logout_all_res = client.post(
        "/api/auth/logout",
        json={"all_devices": True},
        headers={"Authorization": f"Bearer {token_all}"}
    )
    assert logout_all_res.status_code == 200
    print(f"    Goi logout all devices: HTTP {logout_all_res.status_code} ({logout_all_res.json()['message']})")

    res_all_revoked = client.get("/api/users/me", headers={"Authorization": f"Bearer {token_all}"})
    assert res_all_revoked.status_code == 401
    print(f"    Token sau khi logout all: HTTP {res_all_revoked.status_code} (Bi tu choi thanh cong)")
    print("[PASS] Test 5: Logout all devices hoat dong chuan xac!")

    # -------------------------------------------------------------------------
    # Test 6: Co che Fail-Open khi Redis Offline
    # -------------------------------------------------------------------------
    print("\n--- Test 6: Co che Fail-Open khi Redis mat ket noi ---")
    time.sleep(1)
    login_failopen = client.post("/api/auth/login", json={"email": email, "password": reset_pass})
    token_failopen = login_failopen.json()["access_token"]

    # Gia lap Redis offline
    redis_client.get_client = lambda: None
    res_failopen = client.get("/api/users/me", headers={"Authorization": f"Bearer {token_failopen}"})
    assert res_failopen.status_code == 200
    print(f"    Khi Redis down, Token hop le van duoc xac thuc: HTTP {res_failopen.status_code} OK")
    print("[PASS] Test 6: Co che Fail-Open bao ve he thong khong bi ngung tre khi Redis down!")

    print("\n==========================================================================")
    print(">>> TẤT CẢ 6/6 MỤC KIỂM THU TOKEN BLACKLIST & REVOCATION ĐẠT 100% PASS! <<<")
    print("==========================================================================")


if __name__ == "__main__":
    run_tests()
