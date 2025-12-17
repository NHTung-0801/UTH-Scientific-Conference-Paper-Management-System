from src.database import SessionLocal, engine
from src.models import User, Base
from src.auth import get_password_hash

def seed():
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()

    if not db.query(User).filter(User.email == "admin@uth.edu.vn").first():
        admin = User(
            email="admin@uth.edu.vn",
            hashed_password=get_password_hash("admin123"),
            role="admin"
        )
        db.add(admin)

    if not db.query(User).filter(User.email == "author@uth.edu.vn").first():
        author = User(
            email="author@uth.edu.vn",
            hashed_password=get_password_hash("author123"),
            role="author"
        )
        db.add(author)

    db.commit()
    db.close()
    print("Seed data inserted")

if __name__ == "__main__":
    seed()
