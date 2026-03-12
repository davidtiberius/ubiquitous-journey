"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  getToken,
  clearToken,
  fetchBooks,
  createBook,
  updateBook,
  deleteBook,
  type Book,
  type BookForm,
} from "@/lib/api";

const STATUSES = [
  { value: "", label: "All" },
  { value: "wantToRead", label: "Want to Read" },
  { value: "reading", label: "Reading" },
  { value: "finished", label: "Finished" },
  { value: "dnf", label: "DNF" },
];

const STATUS_COLORS: Record<string, string> = {
  wantToRead: "bg-gray-500",
  reading: "bg-blue-500",
  finished: "bg-green-500",
  dnf: "bg-yellow-500 text-gray-900",
};

const STATUS_LABELS: Record<string, string> = {
  wantToRead: "Want to Read",
  reading: "Reading",
  finished: "Finished",
  dnf: "DNF",
};

function emptyForm(): BookForm {
  return { title: "", author: "", status: "wantToRead", notes: null, start_date: null, finish_date: null };
}

function formatDate(d: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString();
}

export default function BooksPage() {
  const router = useRouter();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [saving, setSaving] = useState(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [form, setForm] = useState<BookForm>(emptyForm());

  // Delete confirm state
  const [deletingBook, setDeletingBook] = useState<Book | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    loadBooks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadBooks(statusFilter?: string) {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBooks(statusFilter || undefined);
      setBooks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load books");
    } finally {
      setLoading(false);
    }
  }

  function handleFilterChange(value: string) {
    setFilter(value);
    loadBooks(value);
  }

  function openAdd() {
    setEditingBook(null);
    setForm(emptyForm());
    setShowModal(true);
  }

  function openEdit(book: Book) {
    setEditingBook(book);
    setForm({
      title: book.title,
      author: book.author,
      status: book.status,
      notes: book.notes || null,
      start_date: book.start_date ? book.start_date.slice(0, 10) : null,
      finish_date: book.finish_date ? book.finish_date.slice(0, 10) : null,
    });
    setShowModal(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body: BookForm = {
        ...form,
        notes: form.notes || null,
        start_date: form.start_date || null,
        finish_date: form.finish_date || null,
      };
      if (editingBook) {
        await updateBook(editingBook.id, body);
      } else {
        await createBook(body);
      }
      setShowModal(false);
      await loadBooks(filter);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingBook) return;
    setSaving(true);
    setError(null);
    try {
      await deleteBook(deletingBook.id);
      setDeletingBook(null);
      await loadBooks(filter);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() {
    clearToken();
    router.push("/login");
  }

  return (
    <>
      {/* Navbar */}
      <nav className="bg-gray-900 text-white mb-6">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="text-lg font-bold">Book Tracker</span>
          <button
            onClick={handleLogout}
            className="text-sm bg-gray-700 hover:bg-gray-600 rounded px-3 py-1.5 transition-colors"
          >
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4">
        {/* Error */}
        {error && (
          <div className="bg-red-50 text-red-700 rounded px-4 py-3 mb-4 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 text-xl leading-none">&times;</button>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
          <div className="flex gap-1 overflow-x-auto pb-1 -mb-1">
            {STATUSES.map((s) => (
              <button
                key={s.value}
                onClick={() => handleFilterChange(s.value)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filter === s.value
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button
            onClick={openAdd}
            className="bg-blue-600 text-white rounded px-4 py-2 font-medium hover:bg-blue-700 transition-colors w-full sm:w-auto"
          >
            + Add Book
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-16">
            <div className="inline-block w-8 h-8 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
          </div>
        )}

        {/* Empty */}
        {!loading && books.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg">No books found.</p>
          </div>
        )}

        {/* Book grid */}
        {!loading && books.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {books.map((book) => (
              <div
                key={book.id}
                className="bg-white rounded-lg shadow hover:shadow-md transition-shadow flex flex-col"
              >
                <div className="p-4 flex-1">
                  <h3 className="font-semibold text-lg">{book.title}</h3>
                  <p className="text-gray-500 text-sm mb-2">{book.author}</p>
                  <span
                    className={`inline-block text-xs text-white font-medium px-2 py-0.5 rounded mb-2 ${
                      STATUS_COLORS[book.status] || "bg-gray-500"
                    }`}
                  >
                    {STATUS_LABELS[book.status] || book.status}
                  </span>
                  {book.notes && (
                    <p className="text-gray-500 text-sm mt-1">{book.notes}</p>
                  )}
                  {book.start_date && (
                    <p className="text-gray-400 text-xs mt-1">Started: {formatDate(book.start_date)}</p>
                  )}
                  {book.finish_date && (
                    <p className="text-gray-400 text-xs">Finished: {formatDate(book.finish_date)}</p>
                  )}
                </div>
                <div className="border-t px-4 py-2 flex gap-2">
                  <button
                    onClick={() => openEdit(book)}
                    className="text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded px-3 py-1 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeletingBook(book)}
                    className="text-sm text-red-600 hover:text-red-800 border border-red-300 rounded px-3 py-1 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md my-auto">
            <form onSubmit={handleSave}>
              <div className="border-b px-6 py-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  {editingBook ? "Edit Book" : "Add Book"}
                </h2>
                <button type="button" onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
              </div>
              <div className="px-6 py-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    required
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Author</label>
                  <input
                    type="text"
                    required
                    value={form.author}
                    onChange={(e) => setForm({ ...form, author: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="wantToRead">Want to Read</option>
                    <option value="reading">Reading</option>
                    <option value="finished">Finished</option>
                    <option value="dnf">Did Not Finish</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    rows={3}
                    value={form.notes || ""}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={form.start_date || ""}
                      onChange={(e) => setForm({ ...form, start_date: e.target.value || null })}
                      className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Finish Date</label>
                    <input
                      type="date"
                      value={form.finish_date || ""}
                      onChange={(e) => setForm({ ...form, finish_date: e.target.value || null })}
                      className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
              <div className="border-t px-6 py-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Saving..." : editingBook ? "Update" : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingBook && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm">
            <div className="border-b px-6 py-4">
              <h2 className="text-lg font-semibold">Delete Book</h2>
            </div>
            <div className="px-6 py-4">
              Delete <strong>{deletingBook.title}</strong>?
            </div>
            <div className="border-t px-6 py-4 flex justify-end gap-2">
              <button
                onClick={() => setDeletingBook(null)}
                className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="px-4 py-2 bg-red-600 text-white rounded font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {saving ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
