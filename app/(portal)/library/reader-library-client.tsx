"use client";

import { FormEvent, useMemo, useState } from "react";

import type {
  CatalogWorld,
  LibraryBook,
  ReaderChapter,
  ReaderSessionDetail,
  ReaderSessionSummary,
} from "@/lib/reader-runtime";

type Props = {
  initialBooks: LibraryBook[];
  initialCatalogWorlds: CatalogWorld[];
  initialSessions: ReaderSessionSummary[];
  initialActiveSession: ReaderSessionDetail | null;
};

type Message = {
  type: "success" | "error";
  text: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function upsertSessionSummary(
  sessions: ReaderSessionSummary[],
  session: ReaderSessionSummary,
) {
  const withoutExisting = sessions.filter((item) => item.id !== session.id);
  return [session, ...withoutExisting].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
}

function updateSessionAfterChapter(
  sessions: ReaderSessionSummary[],
  sessionId: string,
  chapter: ReaderChapter,
  updatedAt: string,
) {
  return sessions.map((session) => {
    if (session.id !== sessionId) {
      return session;
    }

    return {
      ...session,
      chapterCount: session.chapterCount + 1,
      lastChapterTitle: chapter.title,
      updatedAt,
    };
  });
}

function updateBooksAfterReading(
  books: LibraryBook[],
  session: ReaderSessionDetail,
) {
  return books.map((book) => {
    if (book.id !== session.libraryBook.id) {
      return book;
    }

    return {
      ...book,
      activeSessionId: session.session.id,
      activeChapterCount: session.session.chapterCount,
    };
  });
}

export function LibraryReaderClient({
  initialBooks,
  initialCatalogWorlds,
  initialSessions,
  initialActiveSession,
}: Props) {
  const [books, setBooks] = useState<LibraryBook[]>(initialBooks);
  const [catalogWorlds, setCatalogWorlds] = useState<CatalogWorld[]>(
    initialCatalogWorlds,
  );
  const [sessions, setSessions] = useState<ReaderSessionSummary[]>(initialSessions);
  const [activeSession, setActiveSession] = useState<ReaderSessionDetail | null>(
    initialActiveSession,
  );
  const [directionInput, setDirectionInput] = useState("");
  const [isAddingWorldId, setIsAddingWorldId] = useState<string | null>(null);
  const [isStartingBookId, setIsStartingBookId] = useState<string | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [isGeneratingChapter, setIsGeneratingChapter] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  const sortedBooks = useMemo(
    () => [...books].sort((a, b) => b.addedAt.localeCompare(a.addedAt)),
    [books],
  );

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [sessions],
  );

  const latestChapter = activeSession?.chapters[activeSession.chapters.length - 1] ?? null;

  async function refreshLibraryAndCatalog() {
    const [booksResponse, worldsResponse] = await Promise.all([
      fetch("/api/reader/library", {
        method: "GET",
        cache: "no-store",
      }),
      fetch("/api/reader/worlds", {
        method: "GET",
        cache: "no-store",
      }),
    ]);

    const booksPayload = (await booksResponse.json().catch(() => null)) as
      | { books?: LibraryBook[]; error?: string }
      | null;
    const worldsPayload = (await worldsResponse.json().catch(() => null)) as
      | { worlds?: CatalogWorld[]; error?: string }
      | null;

    if (!booksResponse.ok || !booksPayload?.books) {
      throw new Error(booksPayload?.error ?? "Could not refresh library books.");
    }

    if (!worldsResponse.ok || !worldsPayload?.worlds) {
      throw new Error(worldsPayload?.error ?? "Could not refresh catalog books.");
    }

    setBooks(booksPayload.books);
    setCatalogWorlds(worldsPayload.worlds);
  }

  async function handleAddToLibrary(worldId: string) {
    setIsAddingWorldId(worldId);
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
        | { book?: LibraryBook; error?: string }
        | null;

      if (!response.ok || !payload?.book) {
        throw new Error(payload?.error ?? "Could not add book to library.");
      }

      const addedBook = payload.book;

      setBooks((current) => {
        const exists = current.some((book) => book.id === addedBook.id);

        if (exists) {
          return current;
        }

        return [addedBook, ...current];
      });

      setCatalogWorlds((current) =>
        current.filter((world) => world.id !== addedBook.worldId),
      );
      setMessage({
        type: "success",
        text: `Added ${addedBook.title} to your library.`,
      });
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Could not add book to library.",
      });
    } finally {
      setIsAddingWorldId(null);
    }
  }

  async function handleStartReading(libraryBookId: string) {
    setIsStartingBookId(libraryBookId);
    setMessage(null);

    try {
      const response = await fetch("/api/reader/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ libraryBookId }),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            session?: ReaderSessionDetail;
            chapter?: ReaderChapter | null;
            error?: string;
          }
        | null;

      if (!response.ok || !payload?.session) {
        throw new Error(payload?.error ?? "Could not start reading.");
      }

      const readingSession = payload.session;
      setActiveSession(readingSession);
      setSessions((current) => upsertSessionSummary(current, readingSession.session));
      setBooks((current) => updateBooksAfterReading(current, readingSession));
      setDirectionInput("");

      if (payload.chapter) {
        setMessage({
          type: "success",
          text: `Chapter 1 generated for ${readingSession.libraryBook.title}.`,
        });
      } else {
        setMessage({
          type: "success",
          text: `Resumed ${readingSession.libraryBook.title}.`,
        });
      }
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error ? error.message : "Could not start reading.",
      });
    } finally {
      setIsStartingBookId(null);
    }
  }

  async function handleSelectSession(sessionId: string) {
    setIsLoadingSession(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/reader/sessions/${sessionId}`, {
        method: "GET",
        cache: "no-store",
      });

      const payload = (await response.json().catch(() => null)) as
        | { session?: ReaderSessionDetail; error?: string }
        | null;

      if (!response.ok || !payload?.session) {
        throw new Error(payload?.error ?? "Could not load reading session.");
      }

      setActiveSession(payload.session);
      setDirectionInput("");
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Could not load reading session.",
      });
    } finally {
      setIsLoadingSession(false);
    }
  }

  async function handleGenerateNextChapter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeSession) {
      return;
    }

    setIsGeneratingChapter(true);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/reader/sessions/${activeSession.session.id}/turns`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            directionInput: directionInput.trim() || undefined,
          }),
        },
      );

      const payload = (await response.json().catch(() => null)) as
        | {
            chapter?: ReaderChapter;
            sessionUpdatedAt?: string;
            error?: string;
          }
        | null;

      if (!response.ok || !payload?.chapter || !payload.sessionUpdatedAt) {
        throw new Error(payload?.error ?? "Could not generate the next chapter.");
      }

      const { chapter, sessionUpdatedAt } = payload;

      setActiveSession((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          session: {
            ...current.session,
            chapterCount: current.session.chapterCount + 1,
            lastChapterTitle: chapter.title,
            updatedAt: sessionUpdatedAt,
          },
          libraryBook: {
            ...current.libraryBook,
            activeSessionId: current.session.id,
            activeChapterCount: current.session.chapterCount + 1,
          },
          chapters: [...current.chapters, chapter],
        };
      });

      setSessions((current) =>
        updateSessionAfterChapter(
          current,
          activeSession.session.id,
          chapter,
          sessionUpdatedAt,
        ),
      );
      setBooks((current) =>
        current.map((book) => {
          if (book.id !== activeSession.libraryBook.id) {
            return book;
          }

          return {
            ...book,
            activeSessionId: activeSession.session.id,
            activeChapterCount: book.activeChapterCount + 1,
          };
        }),
      );
      setDirectionInput("");
      setMessage({
        type: "success",
        text: `${chapter.title} generated with ${chapter.model}.`,
      });
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Could not generate the next chapter.",
      });
    } finally {
      setIsGeneratingChapter(false);
    }
  }

  if (activeSession) {
    return (
      <main className="space-y-6">
        <section className="parchment-surface rounded-[1.75rem] px-5 py-6 shadow-2xl backdrop-blur-md sm:px-6 sm:py-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs tracking-[0.18em] text-[var(--ink-muted)] uppercase">Reader Mode</p>
              <h2 className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl">
                {activeSession.libraryBook.title}
              </h2>
              <p className="mt-2 text-sm text-[var(--ink-muted)]">
                Full-page reader | Chapters {activeSession.session.chapterCount}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveSession(null)}
              className="rounded-full border border-[var(--parchment-border)] px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--parchment-soft)]"
            >
              Back To Library
            </button>
          </div>
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

        <article className="parchment-card rounded-2xl p-5 shadow-lg sm:p-6">
          <div className="mx-auto w-full max-w-4xl space-y-5">
            <div className="rounded-lg border border-[var(--parchment-border)] bg-[var(--parchment-soft)] px-4 py-3">
              <p className="text-sm font-semibold">{activeSession.libraryBook.title}</p>
              <p className="mt-1 text-xs text-[var(--ink-muted)]">
                Session {activeSession.session.status} | Updated {formatDate(activeSession.session.updatedAt)}
              </p>
            </div>

            <div className="space-y-5">
              {activeSession.chapters.length === 0 ? (
                <p className="rounded-lg border border-[var(--parchment-border)] bg-[var(--parchment-soft)] px-4 py-3 text-sm text-[var(--ink-muted)]">
                  Generating first chapter...
                </p>
              ) : (
                activeSession.chapters.map((chapter) => (
                  <article
                    key={chapter.id}
                    className="rounded-lg border border-[var(--parchment-border)] bg-[var(--parchment-soft)] px-4 py-5"
                  >
                    <p className="text-xs tracking-[0.12em] text-[var(--ink-muted)] uppercase">
                      Chapter {chapter.chapterNumber}
                    </p>
                    <h3 className="mt-1 text-2xl font-semibold">{chapter.title}</h3>
                    <p className="mt-4 whitespace-pre-wrap text-base leading-8 text-[var(--ink)]">
                      {chapter.content}
                    </p>
                  </article>
                ))
              )}
            </div>

            <form className="rounded-lg border border-[var(--parchment-border)] bg-[var(--parchment-soft)] px-4 py-4 space-y-3" onSubmit={handleGenerateNextChapter}>
              <p className="text-sm font-semibold">How should the next chapter go?</p>

              {latestChapter && latestChapter.choiceOptions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {latestChapter.choiceOptions.map((choice) => (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => setDirectionInput(choice)}
                      className="rounded-full border border-[var(--parchment-border)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:bg-white/65"
                    >
                      {choice}
                    </button>
                  ))}
                </div>
              ) : null}

              <textarea
                value={directionInput}
                onChange={(event) => setDirectionInput(event.target.value)}
                placeholder="Type your own suggestion for the next chapter..."
                className="parchment-input min-h-[96px] w-full rounded-lg px-3 py-2 text-sm outline-none"
                maxLength={2500}
                disabled={isGeneratingChapter || isLoadingSession}
              />

              <button
                type="submit"
                disabled={isGeneratingChapter || isLoadingSession}
                className="parchment-button rounded-full px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isGeneratingChapter
                  ? "Generating Next Chapter..."
                  : isLoadingSession
                    ? "Loading..."
                    : "Generate Next Chapter"}
              </button>
            </form>
          </div>
        </article>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <section className="parchment-surface rounded-[1.75rem] px-5 py-6 shadow-2xl backdrop-blur-md sm:px-6 sm:py-7">
        <p className="text-xs tracking-[0.18em] text-[var(--ink-muted)] uppercase">Library</p>
        <h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">
          Add books to your library, then read chapter by chapter.
        </h2>
        <p className="mt-4 max-w-4xl text-base leading-7 text-[var(--ink-muted)] sm:text-lg">
          Creator books are automatically added to your own library. Open any book from
          your shelf to enter full-page reader mode.
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

      <section className="space-y-5">
        <article className="parchment-card rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-2xl font-semibold">Your Library Shelf</h3>
            <button
              type="button"
              onClick={() => {
                void refreshLibraryAndCatalog().catch((error: unknown) => {
                  setMessage({
                    type: "error",
                    text:
                      error instanceof Error
                        ? error.message
                        : "Could not refresh library.",
                  });
                });
              }}
              className="rounded-full border border-[var(--parchment-border)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:bg-[var(--parchment-soft)]"
            >
              Refresh
            </button>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sortedBooks.length === 0 ? (
              <p className="rounded-lg border border-[var(--parchment-border)] bg-[var(--parchment-soft)] px-3 py-3 text-sm text-[var(--ink-muted)] md:col-span-2 xl:col-span-3">
                No books in library yet.
              </p>
            ) : (
              sortedBooks.map((book) => (
                <article
                  key={book.id}
                  className="flex h-full flex-col justify-between rounded-lg border border-[var(--parchment-border)] bg-[var(--parchment-soft)] px-4 py-4"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-lg font-semibold leading-tight">{book.title}</h4>
                        <p className="mt-1 text-xs text-[var(--ink-muted)]">/{book.slug}</p>
                      </div>
                      <span className="rounded-full border border-[var(--parchment-border)] bg-white/45 px-2 py-0.5 text-xs text-[var(--ink-muted)]">
                        {book.status}
                      </span>
                    </div>

                    <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
                      {book.premise?.trim()
                        ? book.premise
                        : "No brief description yet. Start reading to build your chapter journey."}
                    </p>
                  </div>

                  <div className="mt-4">
                    <p className="text-xs text-[var(--ink-muted)]">
                      Added {formatDate(book.addedAt)} | Chapters read {book.activeChapterCount}
                    </p>
                    <button
                      type="button"
                      disabled={Boolean(isStartingBookId)}
                      onClick={() => {
                        void handleStartReading(book.id);
                      }}
                      className="parchment-button mt-3 rounded-full px-4 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isStartingBookId === book.id
                        ? "Opening..."
                        : book.activeSessionId
                          ? "Continue Reading"
                          : "Read From Library"}
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </article>

        <article className="parchment-card rounded-2xl p-5 shadow-lg">
          <h4 className="text-xl font-semibold">Add From Catalog</h4>
          <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {catalogWorlds.length === 0 ? (
              <p className="rounded-lg border border-[var(--parchment-border)] bg-[var(--parchment-soft)] px-3 py-3 text-sm text-[var(--ink-muted)] md:col-span-2 xl:col-span-3">
                No additional books available to add.
              </p>
            ) : (
              catalogWorlds.map((world) => (
                <article
                  key={world.id}
                  className="flex h-full flex-col justify-between rounded-lg border border-[var(--parchment-border)] bg-[var(--parchment-soft)] px-4 py-4"
                >
                  <div>
                    <p className="text-base font-semibold leading-tight">{world.title}</p>
                    <p className="mt-1 text-xs text-[var(--ink-muted)]">/{world.slug}</p>
                    <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
                      {world.premise?.trim()
                        ? world.premise
                        : "No brief description provided yet."}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={Boolean(isAddingWorldId)}
                    onClick={() => {
                      void handleAddToLibrary(world.id);
                    }}
                    className="mt-3 rounded-full border border-[var(--parchment-border)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:bg-white/65 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isAddingWorldId === world.id ? "Adding..." : "Add To Library"}
                  </button>
                </article>
              ))
            )}
          </div>
        </article>

        <article className="parchment-card rounded-2xl p-5 shadow-lg">
          <h3 className="text-2xl font-semibold">Recent Sessions</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {sortedSessions.length === 0 ? (
              <p className="rounded-lg border border-[var(--parchment-border)] bg-[var(--parchment-soft)] px-3 py-3 text-sm text-[var(--ink-muted)] md:col-span-2">
                No reading sessions yet.
              </p>
            ) : (
              sortedSessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => {
                    void handleSelectSession(session.id);
                  }}
                  className="rounded-lg border border-[var(--parchment-border)] bg-[var(--parchment-soft)] px-3 py-2 text-left transition hover:bg-white/65"
                >
                  <p className="text-sm font-semibold">{session.worldTitle}</p>
                  <p className="mt-1 text-xs text-[var(--ink-muted)]">
                    Chapters {session.chapterCount}
                  </p>
                  <p className="mt-1 text-xs text-[var(--ink-muted)]">
                    Updated {formatDate(session.updatedAt)}
                  </p>
                </button>
              ))
            )}
          </div>
        </article>
      </section>
    </main>
  );
}
