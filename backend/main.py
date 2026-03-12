import os
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from .auth import create_access_token, get_current_user, hash_password, require_admin, verify_password
from .database import Base, SessionLocal, engine, get_db
from .models import Book, User
from .schemas import BookCreate, BookOut, BookUpdate, ChangePasswordRequest, LoginRequest, Token, UserCreate, UserOut

from sqlalchemy import inspect, text

# ── Migrate existing DB if needed ──
_inspector = inspect(engine)
_existing_tables = _inspector.get_table_names()

if "users" not in _existing_tables:
    # Create only the users table first (books table already exists)
    User.__table__.create(bind=engine)

if "books" in _existing_tables:
    _book_columns = [c["name"] for c in _inspector.get_columns("books")]
    if "owner_id" not in _book_columns:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE books ADD COLUMN owner_id VARCHAR"))

# Now create any remaining tables (no-op for ones that exist)
Base.metadata.create_all(bind=engine)

# ── Seed users on startup ──
_db = SessionLocal()
try:
    # Seed admin user
    _admin_username = os.environ.get("ADMIN_USERNAME", "admin")
    _admin_password = os.environ.get("ADMIN_PASSWORD", "admin")
    if not _db.query(User).filter(User.is_admin.is_(True)).first():
        _db.add(User(
            username=_admin_username,
            password_hash=hash_password(_admin_password),
            is_admin=True,
        ))
        _db.commit()

    # Seed default user "david" and assign any unowned books
    _default_user = _db.query(User).filter(User.username == "david").first()
    if not _default_user:
        _default_user = User(
            username="david",
            password_hash=hash_password("david"),
        )
        _db.add(_default_user)
        _db.commit()
        _db.refresh(_default_user)

    # Assign any books with no owner to david
    _unowned = _db.query(Book).filter(Book.owner_id.is_(None)).count()
    if _unowned:
        _db.query(Book).filter(Book.owner_id.is_(None)).update({"owner_id": _default_user.id})
        _db.commit()

    # Now enforce NOT NULL on owner_id if the DB supports it
    # (SQLite doesn't support ALTER COLUMN, but the column will be NOT NULL for new rows via the ORM)
    if not engine.url.drivername.startswith("sqlite"):
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE books ALTER COLUMN owner_id SET NOT NULL"))
finally:
    _db.close()

app = FastAPI(title="BookTracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health ──

@app.get("/healthz")
def healthz():
    return {"status": "ok"}


# ── Auth endpoints ──

@app.post("/auth/login", response_model=Token)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == body.username).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return Token(access_token=create_access_token(user.id))


@app.post("/auth/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(body: UserCreate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already taken")
    user = User(username=body.username, password_hash=hash_password(body.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.get("/auth/users", response_model=list[UserOut])
def list_users(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    return db.query(User).all()


@app.put("/auth/password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(body: ChangePasswordRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    if len(body.new_password) < 8:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="New password must be at least 8 characters")
    current_user.password_hash = hash_password(body.new_password)
    db.commit()


# ── Book endpoints (scoped to current user) ──

@app.get("/books", response_model=list[BookOut])
def list_books(status: str | None = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(Book).filter(Book.owner_id == current_user.id)
    if status:
        query = query.filter(Book.status == status)
    return query.order_by(Book.created_at.desc()).all()


@app.post("/books", response_model=BookOut, status_code=status.HTTP_201_CREATED)
def create_book(body: BookCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    data = body.model_dump()
    book_id = str(data.pop("id")) if data.get("id") else None
    book = Book(**data, owner_id=current_user.id, **({"id": book_id} if book_id else {}))
    db.add(book)
    db.commit()
    db.refresh(book)
    return book


@app.get("/books/{book_id}", response_model=BookOut)
def get_book(book_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    book = db.query(Book).filter(Book.id == book_id, Book.owner_id == current_user.id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return book


@app.put("/books/{book_id}", response_model=BookOut)
def update_book(book_id: str, body: BookUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    book = db.query(Book).filter(Book.id == book_id, Book.owner_id == current_user.id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(book, field, value)
    db.commit()
    db.refresh(book)
    return book


@app.delete("/books/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_book(book_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    book = db.query(Book).filter(Book.id == book_id, Book.owner_id == current_user.id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    db.delete(book)
    db.commit()


frontend_dir = Path(__file__).resolve().parent.parent / "frontend-next" / "out"
if frontend_dir.is_dir():
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
