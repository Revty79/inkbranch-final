"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { BookstoreBook } from "@/lib/reader-runtime";

type Props = {
  initialBooks: BookstoreBook[];
};

type Message = {
  type: "success" | "error";
  text: string;
};

const ALL_GENRES_FILTER_VALUE = "__ALL__";

function getGenreLabel(genre: string | null | undefined) {
  const trimmed = genre?.trim();
  return trimmed ? trimmed : "Uncategorized";
}

function normalizeSearchValue(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function toBookstoreSearchText(book: BookstoreBook) {
  return [
    book.title,
    book.slug,
    getGenreLabel(book.genre),
    book.authorName,
    book.authorEmail,
    book.premise,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();
}

function sortGenreLabels(left: string, right: string) {
  if (left === right) {
    return 0;
  }

  if (left === "Uncategorized") {
    return 1;
  }

  if (right === "Uncategorized") {
    return -1;
  }

  return left.localeCompare(right);
}

function groupBooksByGenre(books: BookstoreBook[]) {
  const groups = new Map<string, BookstoreBook[]>();

  for (const book of books) {
    const genreLabel = getGenreLabel(book.genre);
    const existing = groups.get(genreLabel);

    if (existing) {
      existing.push(book);
    } else {
      groups.set(genreLabel, [book]);
    }
  }

  return [...groups.entries()]
    .map(([genre, groupedBooks]) => ({
      genre,
      books: [...groupedBooks].sort((a, b) => a.title.localeCompare(b.title)),
    }))
    .sort((a, b) => sortGenreLabels(a.genre, b.genre));
}

export function BookstoreClient({ initialBooks }: Props) {
  const [books, setBooks] = useState<BookstoreBook[]>(initialBooks);
  const [addingWorldId, setAddingWorldId] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [genreFilter, setGenreFilter] = useState(ALL_GENRES_FILTER_VALUE);

  const genreFilterOptions = useMemo(
    () =>
      [...new Set(books.map((book) => getGenreLabel(book.genre)))].sort(
        sortGenreLabels,
      ),
    [books],
  );
  const filteredBooks = useMemo(() => {
    const normalizedSearch = normalizeSearchValue(searchInput);

    return books.filter((book) => {
      if (
        genreFilter !== ALL_GENRES_FILTER_VALUE &&
        getGenreLabel(book.genre) !== genreFilter
      ) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return toBookstoreSearchText(book).includes(normalizedSearch);
    });
  }, [books, genreFilter, searchInput]);
  const groupedBooks = useMemo(
    () => groupBooksByGenre(filteredBooks),
    [filteredBooks],
  );

  async function handleAddToLibrary(worldId: string) {
    setAddingWorldId(worldId);
    setMessage(null);

    try {
      const response = await fetch("/api/reader/library", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ worldId }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Could not add book to library.");
      }

      setBooks((current) =>
        current.map((book) =>
          book.id === worldId ? { ...book, inLibrary: true } : book,
        ),
      );
      setMessage({ type: "success", text: "Book added to your library." });
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Could not add book to library.",
      });
    } finally {
      setAddingWorldId(null);
    }
  }

  return (
    <main className="space-y-6">
      <section className="parchment-surface rounded-[1.75rem] px-5 py-6 shadow-2xl backdrop-blur-md sm:px-6 sm:py-7">
        <p className="text-xs tracking-[0.18em] text-[var(--ink-muted)] uppercase">
          Bookstore
        </p>
        <h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">
          Discover books, then move them to your library shelf.
        </h2>
        <p className="mt-4 max-w-4xl text-base leading-7 text-[var(--ink-muted)] sm:text-lg">
          The storefront now uses your actual authored worlds. Add books to your
          library, then open them in full-page reader mode.
        </p>
      </section>

      {message ? (
        <section>
          <p
            className={`rounded-xl border px-4 py-3 text-sm ${
              message.type === "success"
                ? "border-emerald-700/40 bg-emerald-100/75 text-emerald-900"
                : "border-rose-700/40 bg-rose-100/75 text-rose-900"
            }`}
          >
            {message.text}
          </p>
        </section>
      ) : null}

      <section className="parchment-card rounded-2xl p-5 shadow-lg">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
          <label className="space-y-1 text-sm">
            <span className="parchment-label block text-sm font-medium">
              Search books
            </span>
            <input
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Title, genre, author, premise..."
              className="parchment-input w-full rounded-lg px-3 py-2 text-sm outline-none"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="parchment-label block text-sm font-medium">Genre</span>
            <select
              value={genreFilter}
              onChange={(event) => setGenreFilter(event.target.value)}
              className="parchment-input w-full rounded-lg px-3 py-2 text-sm outline-none"
            >
              <option value={ALL_GENRES_FILTER_VALUE}>All genres</option>
              {genreFilterOptions.map((genre) => (
                <option key={genre} value={genre}>
                  {genre}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="space-y-5">
        {books.length === 0 ? (
          <div className="parchment-card rounded-2xl p-5 shadow-lg">
            <p className="text-sm text-[var(--ink-muted)]">
              No books are available in the storefront yet.
            </p>
          </div>
        ) : filteredBooks.length === 0 ? (
          <div className="parchment-card rounded-2xl p-5 shadow-lg">
            <p className="text-sm text-[var(--ink-muted)]">
              No books match your search or genre filter.
            </p>
          </div>
        ) : (
          groupedBooks.map((group) => (
            <div key={group.genre} className="space-y-3">
              <p className="text-xs tracking-[0.12em] text-[var(--ink-muted)] uppercase">
                {group.genre}
              </p>
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {group.books.map((book) => (
                  <article
                    key={book.id}
                    className={`book-card ${book.inLibrary ? "book-card-library" : "book-card-bookstore"}`}
                  >
                    <div className="relative z-10">
                      <p className="book-card-kicker">
                        {book.authorName?.trim() || book.authorEmail}
                      </p>
                      <h3 className="book-card-title">{book.title}</h3>
                      <p className="book-card-description">
                        {book.premise?.trim()
                          ? book.premise
                          : "No brief description yet. Open this world to begin shaping the reader experience."}
                      </p>
                    </div>

                    <div className="relative z-10 mt-5 flex items-end justify-between gap-3">
                      <span className="book-card-status">
                        {book.inLibrary ? "In your library" : "Available"}
                      </span>

                      {book.inLibrary ? (
                        <Link
                          href="/library"
                          className="rounded-full border border-[rgba(248,239,219,0.55)] px-3 py-1.5 text-xs font-semibold text-[rgba(248,239,219,0.95)] transition hover:bg-[rgba(255,255,255,0.14)]"
                        >
                          Open Library
                        </Link>
                      ) : (
                        <button
                          type="button"
                          disabled={Boolean(addingWorldId)}
                          onClick={() => {
                            void handleAddToLibrary(book.id);
                          }}
                          className="rounded-full border border-[rgba(248,239,219,0.55)] px-3 py-1.5 text-xs font-semibold text-[rgba(248,239,219,0.95)] transition hover:bg-[rgba(255,255,255,0.14)] disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {addingWorldId === book.id ? "Adding..." : "Add To Library"}
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </main>
  );
}
