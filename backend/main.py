from fastapi import Depends, FastAPI, HTTPException, status
from sqlalchemy.orm import Session

from .auth import require_api_key
from .database import Base, engine, get_db
from .models import Book
from .schemas import BookCreate, BookOut, BookUpdate

Base.metadata.create_all(bind=engine)

app = FastAPI(title="BookTracker API")


@app.get("/books", response_model=list[BookOut], dependencies=[Depends(require_api_key)])
def list_books(status: str | None = None, db: Session = Depends(get_db)):
    query = db.query(Book)
    if status:
        query = query.filter(Book.status == status)
    return query.order_by(Book.created_at.desc()).all()


@app.post("/books", response_model=BookOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_api_key)])
def create_book(body: BookCreate, db: Session = Depends(get_db)):
    data = body.model_dump()
    book_id = str(data.pop("id")) if data.get("id") else None
    book = Book(**data, **({"id": book_id} if book_id else {}))
    db.add(book)
    db.commit()
    db.refresh(book)
    return book


@app.get("/books/{book_id}", response_model=BookOut, dependencies=[Depends(require_api_key)])
def get_book(book_id: str, db: Session = Depends(get_db)):
    book = db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return book


@app.put("/books/{book_id}", response_model=BookOut, dependencies=[Depends(require_api_key)])
def update_book(book_id: str, body: BookUpdate, db: Session = Depends(get_db)):
    book = db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(book, field, value)
    db.commit()
    db.refresh(book)
    return book


@app.delete("/books/{book_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_api_key)])
def delete_book(book_id: str, db: Session = Depends(get_db)):
    book = db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    db.delete(book)
    db.commit()
