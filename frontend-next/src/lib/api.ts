const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

// ── Token helpers ──

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("booktracker_token");
}

export function setToken(token: string) {
  localStorage.setItem("booktracker_token", token);
}

export function clearToken() {
  localStorage.removeItem("booktracker_token");
}

// ── Types ──

export interface Book {
  id: string;
  title: string;
  author: string;
  status: string;
  notes: string | null;
  start_date: string | null;
  finish_date: string | null;
  created_at: string;
}

export interface BookForm {
  title: string;
  author: string;
  status: string;
  notes: string | null;
  start_date: string | null;
  finish_date: string | null;
}

// ── Fetch wrapper ──

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401 || res.status === 403) {
    clearToken();
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Error ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Auth ──

export async function login(username: string, password: string): Promise<void> {
  const data = await apiFetch<{ access_token: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  setToken(data.access_token);
}

// ── Books ──

export async function fetchBooks(status?: string): Promise<Book[]> {
  const query = status ? `?status=${status}` : "";
  return apiFetch<Book[]>(`/books${query}`);
}

export async function createBook(book: BookForm): Promise<Book> {
  return apiFetch<Book>("/books", {
    method: "POST",
    body: JSON.stringify(book),
  });
}

export async function updateBook(id: string, book: BookForm): Promise<Book> {
  return apiFetch<Book>(`/books/${id}`, {
    method: "PUT",
    body: JSON.stringify(book),
  });
}

export async function deleteBook(id: string): Promise<void> {
  return apiFetch<void>(`/books/${id}`, { method: "DELETE" });
}
