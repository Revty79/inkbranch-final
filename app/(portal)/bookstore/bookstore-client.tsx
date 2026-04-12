"use client";

import Link from "next/link";
import { useState } from "react";

import type { BookstoreBook } from "@/lib/reader-runtime";

type Props = {
  initialBooks: BookstoreBook[];
};

type Message = {
  type: "success" | "error";
  text: string;
};

export function BookstoreClient({ initialBooks }: Props) {
  const [books, setBooks] = useState<BookstoreBook[]>(initialBooks);
  const [addingWorldId, setAddingWorldId] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);

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

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {books.length === 0 ? (
          <div className="parchment-card rounded-2xl p-5 shadow-lg md:col-span-2 xl:col-span-3">
            <p className="text-sm text-[var(--ink-muted)]">
              No books are available in the storefront yet.
            </p>
          </div>
        ) : (
          books.map((book) => (
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
          ))
        )}
      </section>
    </main>
  );
}
