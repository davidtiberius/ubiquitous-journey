from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel


class ReadingStatus(str, Enum):
    want_to_read = "wantToRead"
    reading = "reading"
    finished = "finished"
    dnf = "dnf"


# ── Auth schemas ──

class LoginRequest(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: UUID
    username: str
    is_admin: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Book schemas ──

class BookBase(BaseModel):
    title: str
    author: str
    status: ReadingStatus = ReadingStatus.want_to_read
    notes: str | None = None
    start_date: datetime | None = None
    finish_date: datetime | None = None


class BookCreate(BookBase):
    id: UUID | None = None  # allow client to supply its own UUID for sync purposes


class BookUpdate(BookBase):
    title: str | None = None
    author: str | None = None
    status: ReadingStatus | None = None


class BookOut(BookBase):
    id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}
