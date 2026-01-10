from src.database import SessionLocal
from src.models import User, Role
from src.auth import get_password_hash

def seed():
    db = SessionLocal()
    try:
        # 1. Đảm bảo các Role đã tồn tại trước
        # (Lấy role từ DB ra để gán cho user)
        role_admin = db.query(Role).filter(Role.role_name == "ADMIN").first()
        role_author = db.query(Role).filter(Role.role_name == "AUTHOR").first()
        
        # Nếu chưa có Role thì tạo mới (phòng trường hợp init_db chưa chạy)
        if not role_admin:
            role_admin = Role(role_name="ADMIN")
            db.add(role_admin)
        
        if not role_author:
            role_author = Role(role_name="AUTHOR")
            db.add(role_author)
            
        db.commit() # Lưu Role để có ID trước khi gán cho User

        # 2. Tạo User Admin
        if not db.query(User).filter(User.email == "admin@uth.edu.vn").first():
            admin_user = User(
                email="admin@uth.edu.vn",
                password_hash=get_password_hash("admin123"), # Sửa tên cột thành password_hash
                full_name="System Administrator",
                is_active=True
            )
            # Gán quyền thông qua relationship
            admin_user.roles.append(role_admin) 
            db.add(admin_user)
            print("Creating user: admin@uth.edu.vn")

        # 3. Tạo User Author
        if not db.query(User).filter(User.email == "author@uth.edu.vn").first():
            author_user = User(
                email="author@uth.edu.vn",
                password_hash=get_password_hash("author123"), # Sửa tên cột thành password_hash
                full_name="Demo Author",
                is_active=True
            )
            # Gán quyền thông qua relationship
            author_user.roles.append(role_author)
            db.add(author_user)
            print("Creating user: author@uth.edu.vn")

        db.commit()
        print("--- Seed data inserted successfully ---")

    except Exception as e:
        print(f"Error seeding data: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed()