"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

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

const FALLBACK_READER_PAGE_CHAR_LIMIT = 1900;
const MIN_READER_VIEWPORT_WIDTH = 220;
const MIN_READER_VIEWPORT_HEIGHT = 180;
const MOBILE_READER_PAGINATION_MAX_WIDTH = 768;

type ReaderPageViewport = {
  width: number;
  height: number;
  styleSource: HTMLElement;
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

function splitParagraphByLength(paragraph: string, maxLength: number) {
  const words = paragraph.split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return [];
  }

  const chunks: string[] = [];
  let currentChunk = "";

  for (const word of words) {
    const nextChunk = currentChunk ? `${currentChunk} ${word}` : word;

    if (currentChunk && nextChunk.length > maxLength) {
      chunks.push(currentChunk);
      currentChunk = word;
      continue;
    }

    currentChunk = nextChunk;
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

function normalizeChapterText(content: string) {
  return content
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

function paginateChapterContentFallback(
  content: string,
  pageCharLimit = FALLBACK_READER_PAGE_CHAR_LIMIT,
) {
  const trimmedContent = normalizeChapterText(content);

  if (!trimmedContent) {
    return [""];
  }

  const rawParagraphs = trimmedContent
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const normalizedParagraphs = rawParagraphs.flatMap((paragraph) =>
    paragraph.length > pageCharLimit
      ? splitParagraphByLength(paragraph, pageCharLimit)
      : [paragraph],
  );

  const pages: string[] = [];
  let currentParagraphs: string[] = [];
  let currentLength = 0;

  for (const paragraph of normalizedParagraphs) {
    const paragraphLength = paragraph.length;
    const joinerLength = currentParagraphs.length > 0 ? 2 : 0;
    const nextLength = currentLength + joinerLength + paragraphLength;

    if (currentParagraphs.length > 0 && nextLength > pageCharLimit) {
      pages.push(currentParagraphs.join("\n\n"));
      currentParagraphs = [paragraph];
      currentLength = paragraphLength;
      continue;
    }

    currentParagraphs.push(paragraph);
    currentLength = nextLength;
  }

  if (currentParagraphs.length > 0) {
    pages.push(currentParagraphs.join("\n\n"));
  }

  return pages.length > 0 ? pages : [trimmedContent];
}

function tokenizeChapterForPagination(content: string) {
  const normalized = normalizeChapterText(content);

  if (!normalized) {
    return [] as string[];
  }

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const tokens: string[] = [];

  for (let paragraphIndex = 0; paragraphIndex < paragraphs.length; paragraphIndex += 1) {
    const paragraph = paragraphs[paragraphIndex];
    const words = paragraph.split(/\s+/).filter(Boolean);

    for (let wordIndex = 0; wordIndex < words.length; wordIndex += 1) {
      const word = words[wordIndex];
      tokens.push(wordIndex === 0 ? word : ` ${word}`);
    }

    if (paragraphIndex < paragraphs.length - 1) {
      tokens.push("\n\n");
    }
  }

  return tokens;
}

function paginateChapterContent(content: string, viewport: ReaderPageViewport) {
  const trimmedContent = content.trim();

  if (!trimmedContent) {
    return [""];
  }

  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    viewport.width < MIN_READER_VIEWPORT_WIDTH ||
    viewport.height < MIN_READER_VIEWPORT_HEIGHT
  ) {
    return paginateChapterContentFallback(trimmedContent);
  }

  const tokens = tokenizeChapterForPagination(trimmedContent);

  if (tokens.length === 0) {
    return [trimmedContent];
  }

  const measurer = document.createElement("div");
  const computed = window.getComputedStyle(viewport.styleSource);
  const typographyProperties = [
    "font-family",
    "font-size",
    "font-style",
    "font-weight",
    "font-stretch",
    "line-height",
    "letter-spacing",
    "word-spacing",
    "text-transform",
    "text-indent",
  ];

  for (const property of typographyProperties) {
    measurer.style.setProperty(property, computed.getPropertyValue(property));
  }

  measurer.style.width = `${Math.floor(viewport.width)}px`;
  measurer.style.position = "absolute";
  measurer.style.left = "-10000px";
  measurer.style.top = "0";
  measurer.style.visibility = "hidden";
  measurer.style.pointerEvents = "none";
  measurer.style.padding = "0";
  measurer.style.margin = "0";
  measurer.style.border = "0";
  measurer.style.boxSizing = "border-box";
  measurer.style.whiteSpace = "pre-wrap";
  measurer.style.wordBreak = "break-word";
  measurer.style.overflowWrap = "break-word";
  measurer.style.contain = "layout style";
  document.body.appendChild(measurer);

  try {
    const pages: string[] = [];
    const maxHeight = Math.floor(viewport.height);
    let startIndex = 0;

    while (startIndex < tokens.length) {
      let low = startIndex + 1;
      let high = tokens.length;
      let best = startIndex + 1;

      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        measurer.textContent = tokens.slice(startIndex, mid).join("");

        if (measurer.scrollHeight <= maxHeight) {
          best = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      const pageText = tokens
        .slice(startIndex, best)
        .join("")
        .replace(/[ \t]+\n/g, "\n")
        .trim();

      if (pageText) {
        pages.push(pageText);
      }

      startIndex = best;
    }

    return pages.length > 0 ? pages : [trimmedContent];
  } finally {
    measurer.remove();
  }
}

function arePagesEqual(current: string[], next: string[]) {
  if (current.length !== next.length) {
    return false;
  }

  for (let index = 0; index < current.length; index += 1) {
    if (current[index] !== next[index]) {
      return false;
    }
  }

  return true;
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
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(
    initialActiveSession?.chapters[initialActiveSession.chapters.length - 1]?.id ??
      null,
  );
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);
  const [selectedChapterPages, setSelectedChapterPages] = useState<string[]>([]);
  const [readerViewport, setReaderViewport] = useState({ width: 0, height: 0 });
  const readerPageBodyRef = useRef<HTMLDivElement | null>(null);
  const readerPageTextRef = useRef<HTMLParagraphElement | null>(null);

  const sortedBooks = useMemo(
    () => [...books].sort((a, b) => b.addedAt.localeCompare(a.addedAt)),
    [books],
  );

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [sessions],
  );

  const latestChapter = activeSession?.chapters[activeSession.chapters.length - 1] ?? null;
  const selectedChapter =
    activeSession?.chapters.find((chapter) => chapter.id === selectedChapterId) ??
    activeSession?.chapters[activeSession.chapters.length - 1] ??
    null;
  const selectedChapterIndex = selectedChapter
    ? activeSession?.chapters.findIndex((chapter) => chapter.id === selectedChapter.id) ?? -1
    : -1;
  const normalizedPageIndex =
    selectedChapterPages.length === 0
      ? 0
      : Math.min(selectedPageIndex, selectedChapterPages.length - 1);
  const currentPageText = selectedChapterPages[normalizedPageIndex] ?? "";
  const isLatestChapterSelected = Boolean(
    latestChapter && selectedChapter && latestChapter.id === selectedChapter.id,
  );
  const isAtEndOfChapter =
    selectedChapterPages.length > 0 &&
    normalizedPageIndex === selectedChapterPages.length - 1;
  const canGenerateNextChapter = Boolean(
    activeSession &&
      latestChapter &&
      isLatestChapterSelected &&
      isAtEndOfChapter &&
      !isGeneratingChapter &&
      !isLoadingSession,
  );

  useEffect(() => {
    if (!activeSession) {
      setSelectedChapterId(null);
      setSelectedPageIndex(0);
      return;
    }

    const hasSelectedChapter = selectedChapterId
      ? activeSession.chapters.some((chapter) => chapter.id === selectedChapterId)
      : false;

    if (!hasSelectedChapter) {
      const newestChapterId =
        activeSession.chapters[activeSession.chapters.length - 1]?.id ?? null;
      setSelectedChapterId(newestChapterId);
      setSelectedPageIndex(0);
    }
  }, [activeSession, selectedChapterId]);

  useEffect(() => {
    if (selectedChapterPages.length === 0 && selectedPageIndex !== 0) {
      setSelectedPageIndex(0);
      return;
    }

    const maxPageIndex = Math.max(selectedChapterPages.length - 1, 0);

    if (selectedPageIndex > maxPageIndex) {
      setSelectedPageIndex(maxPageIndex);
    }
  }, [selectedChapterPages, selectedPageIndex]);

  useEffect(() => {
    if (!activeSession) {
      setReaderViewport({ width: 0, height: 0 });
      return;
    }

    const readerBody = readerPageBodyRef.current;

    if (!readerBody) {
      return;
    }

    const updateViewport = () => {
      const nextWidth = Math.floor(readerBody.clientWidth);
      const nextHeight = Math.floor(readerBody.clientHeight);

      setReaderViewport((current) => {
        if (current.width === nextWidth && current.height === nextHeight) {
          return current;
        }

        return { width: nextWidth, height: nextHeight };
      });
    };

    updateViewport();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateViewport);

      return () => {
        window.removeEventListener("resize", updateViewport);
      };
    }

    const resizeObserver = new ResizeObserver(() => {
      updateViewport();
    });

    resizeObserver.observe(readerBody);

    return () => {
      resizeObserver.disconnect();
    };
  }, [activeSession, selectedChapter?.id]);

  useEffect(() => {
    if (!selectedChapter) {
      setSelectedChapterPages((current) => (current.length === 0 ? current : []));
      return;
    }

    const fallbackPages = paginateChapterContentFallback(selectedChapter.content);
    const styleSource = readerPageTextRef.current;
    const shouldUseMobilePaginationFallback =
      readerViewport.width > 0 &&
      readerViewport.width <= MOBILE_READER_PAGINATION_MAX_WIDTH;

    if (!styleSource || shouldUseMobilePaginationFallback) {
      setSelectedChapterPages((current) =>
        arePagesEqual(current, fallbackPages) ? current : fallbackPages,
      );
      return;
    }

    const pages = paginateChapterContent(selectedChapter.content, {
      width: readerViewport.width,
      height: readerViewport.height,
      styleSource,
    });

    setSelectedChapterPages((current) => (arePagesEqual(current, pages) ? current : pages));
  }, [readerViewport.height, readerViewport.width, selectedChapter]);

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
      setSelectedChapterId(
        readingSession.chapters[readingSession.chapters.length - 1]?.id ?? null,
      );
      setSelectedPageIndex(0);
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
      setSelectedChapterId(
        payload.session.chapters[payload.session.chapters.length - 1]?.id ?? null,
      );
      setSelectedPageIndex(0);
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
      setSelectedChapterId(chapter.id);
      setSelectedPageIndex(0);

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
              onClick={() => {
                setActiveSession(null);
                setSelectedChapterId(null);
                setSelectedPageIndex(0);
              }}
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

        <section className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="parchment-card rounded-2xl p-4 shadow-lg sm:p-5">
            <h3 className="text-lg font-semibold">Chapter List</h3>
            <p className="mt-1 text-xs text-[var(--ink-muted)]">
              Select a chapter to read. Use page buttons to turn pages.
            </p>

            <div className="mt-4 max-h-[65vh] space-y-2 overflow-y-auto pr-1">
              {activeSession.chapters.length === 0 ? (
                <p className="rounded-lg border border-[var(--parchment-border)] bg-[var(--parchment-soft)] px-3 py-3 text-xs text-[var(--ink-muted)]">
                  Generating first chapter...
                </p>
              ) : (
                activeSession.chapters.map((chapter) => {
                  const isSelected = chapter.id === selectedChapter?.id;

                  return (
                    <button
                      key={chapter.id}
                      type="button"
                      onClick={() => {
                        setSelectedChapterId(chapter.id);
                        setSelectedPageIndex(0);
                      }}
                      className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                        isSelected
                          ? "border-[var(--focus-border)] bg-[var(--parchment-soft)]"
                          : "border-[var(--parchment-border)] bg-white/35 hover:bg-white/60"
                      }`}
                    >
                      <p className="text-[11px] tracking-[0.12em] text-[var(--ink-muted)] uppercase">
                        Chapter {chapter.chapterNumber}
                      </p>
                      <p className="mt-1 text-sm font-semibold leading-tight">{chapter.title}</p>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          <article className="parchment-card rounded-2xl p-4 shadow-lg sm:p-6">
            <div className="mx-auto w-full max-w-4xl space-y-4">
              <div className="rounded-lg border border-[var(--parchment-border)] bg-[var(--parchment-soft)] px-4 py-3">
                <p className="text-sm font-semibold">{activeSession.libraryBook.title}</p>
                <p className="mt-1 text-xs text-[var(--ink-muted)]">
                  Session {activeSession.session.status} | Updated {formatDate(activeSession.session.updatedAt)}
                </p>
              </div>

              {selectedChapter ? (
                <>
                  <article className="flex min-h-[58vh] flex-col rounded-xl border border-[var(--parchment-border)] bg-[var(--parchment-soft)] px-4 py-5 shadow-inner sm:h-[68vh] sm:min-h-[26rem] sm:max-h-[44rem] sm:px-7 sm:py-6">
                    <p className="text-xs tracking-[0.12em] text-[var(--ink-muted)] uppercase">
                      Chapter {selectedChapter.chapterNumber}
                    </p>
                    <h3 className="mt-1 text-xl font-semibold sm:text-2xl">{selectedChapter.title}</h3>
                    <div ref={readerPageBodyRef} className="mt-4 min-h-0 flex-1 sm:mt-5 sm:overflow-hidden">
                      <p
                        ref={readerPageTextRef}
                        className="whitespace-pre-wrap text-sm leading-7 text-[var(--ink)] sm:text-base sm:leading-8"
                      >
                        {currentPageText}
                      </p>
                    </div>
                  </article>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={normalizedPageIndex === 0}
                        onClick={() => {
                          setSelectedPageIndex((index) => Math.max(index - 1, 0));
                        }}
                        className="rounded-full border border-[var(--parchment-border)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:bg-white/65 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Previous Page
                      </button>
                      <button
                        type="button"
                        disabled={normalizedPageIndex >= selectedChapterPages.length - 1}
                        onClick={() => {
                          setSelectedPageIndex((index) =>
                            Math.min(index + 1, Math.max(selectedChapterPages.length - 1, 0)),
                          );
                        }}
                        className="rounded-full border border-[var(--parchment-border)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:bg-white/65 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Next Page
                      </button>
                    </div>

                    <p className="text-xs text-[var(--ink-muted)]">
                      Page {selectedChapterPages.length > 0 ? normalizedPageIndex + 1 : 0} of{" "}
                      {selectedChapterPages.length}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--parchment-border)] bg-white/35 px-3 py-2">
                    <button
                      type="button"
                      disabled={selectedChapterIndex <= 0}
                      onClick={() => {
                        if (!activeSession || selectedChapterIndex <= 0) {
                          return;
                        }

                        const previousChapter = activeSession.chapters[selectedChapterIndex - 1];
                        setSelectedChapterId(previousChapter.id);
                        setSelectedPageIndex(0);
                      }}
                      className="rounded-full border border-[var(--parchment-border)] px-3 py-1 text-xs font-semibold text-[var(--ink)] transition hover:bg-white/65 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Previous Chapter
                    </button>

                    <p className="text-xs text-[var(--ink-muted)]">
                      {isAtEndOfChapter
                        ? "End of chapter reached."
                        : "Turn pages to continue this chapter."}
                    </p>

                    <button
                      type="button"
                      disabled={
                        !activeSession ||
                        selectedChapterIndex < 0 ||
                        selectedChapterIndex >= activeSession.chapters.length - 1
                      }
                      onClick={() => {
                        if (
                          !activeSession ||
                          selectedChapterIndex < 0 ||
                          selectedChapterIndex >= activeSession.chapters.length - 1
                        ) {
                          return;
                        }

                        const nextChapter = activeSession.chapters[selectedChapterIndex + 1];
                        setSelectedChapterId(nextChapter.id);
                        setSelectedPageIndex(0);
                      }}
                      className="rounded-full border border-[var(--parchment-border)] px-3 py-1 text-xs font-semibold text-[var(--ink)] transition hover:bg-white/65 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Next Chapter
                    </button>
                  </div>
                </>
              ) : (
                <p className="rounded-lg border border-[var(--parchment-border)] bg-[var(--parchment-soft)] px-4 py-3 text-sm text-[var(--ink-muted)]">
                  Generating first chapter...
                </p>
              )}
            </div>
          </article>
        </section>

        <form
          className="rounded-lg border border-[var(--parchment-border)] bg-[var(--parchment-soft)] px-4 py-4 space-y-3"
          onSubmit={handleGenerateNextChapter}
        >
          <p className="text-sm font-semibold">How should the next chapter go?</p>
          <p className="text-xs text-[var(--ink-muted)]">
            {!latestChapter
              ? "Waiting for chapter 1..."
              : !isLatestChapterSelected
                ? "Select the latest chapter in the list to continue the book."
                : !isAtEndOfChapter
                  ? "Turn to the last page of this chapter to unlock generation."
                  : "Ready. Choose a suggestion or write your own direction."}
          </p>

          {latestChapter && latestChapter.choiceOptions.length > 0 ? (
            <div className="grid gap-2">
              {latestChapter.choiceOptions.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  onClick={() => setDirectionInput(choice)}
                  className="w-full rounded-xl border border-[var(--parchment-border)] bg-white/45 px-4 py-3 text-left text-sm leading-6 font-medium text-[var(--ink)] transition hover:bg-white/70"
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
            disabled={!canGenerateNextChapter}
            className="parchment-button rounded-full px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isGeneratingChapter
              ? "Generating Next Chapter..."
              : isLoadingSession
                ? "Loading..."
                : !canGenerateNextChapter
                  ? "Reach Chapter End To Continue"
                  : "Generate Next Chapter"}
          </button>
        </form>
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
                  className="book-card book-card-library"
                >
                  <div className="relative z-10">
                    <p className="book-card-kicker">
                      {book.authorName?.trim() || book.authorEmail}
                    </p>
                    <h4 className="book-card-title">{book.title}</h4>
                    <p className="book-card-description">
                      {book.premise?.trim()
                        ? book.premise
                        : "No brief description yet. Start reading to build your chapter journey."}
                    </p>
                  </div>
                  <div className="relative z-10 mt-5 flex items-end justify-between gap-3">
                    <span className="book-card-status">
                      {book.activeSessionId ? "In progress" : "Ready to read"}
                    </span>
                    <button
                      type="button"
                      disabled={Boolean(isStartingBookId)}
                      onClick={() => {
                        void handleStartReading(book.id);
                      }}
                      className="rounded-full border border-[rgba(248,239,219,0.55)] px-3 py-1.5 text-xs font-semibold text-[rgba(248,239,219,0.95)] transition hover:bg-[rgba(255,255,255,0.14)] disabled:cursor-not-allowed disabled:opacity-70"
                      title={`Added ${formatDate(book.addedAt)} | Chapters read ${book.activeChapterCount}`}
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
                  className="book-card book-card-bookstore"
                >
                  <div className="relative z-10">
                    <p className="book-card-kicker">
                      {world.authorName?.trim() || world.authorEmail}
                    </p>
                    <p className="book-card-title">{world.title}</p>
                    <p className="book-card-description">
                      {world.premise?.trim()
                        ? world.premise
                        : "No brief description provided yet."}
                    </p>
                  </div>
                  <div className="relative z-10 mt-5 flex items-end justify-between gap-3">
                    <span className="book-card-status">Available</span>
                  <button
                    type="button"
                    disabled={Boolean(isAddingWorldId)}
                    onClick={() => {
                      void handleAddToLibrary(world.id);
                    }}
                    className="rounded-full border border-[rgba(248,239,219,0.55)] px-3 py-1.5 text-xs font-semibold text-[rgba(248,239,219,0.95)] transition hover:bg-[rgba(255,255,255,0.14)] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isAddingWorldId === world.id ? "Adding..." : "Add To Library"}
                  </button>
                  </div>
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
