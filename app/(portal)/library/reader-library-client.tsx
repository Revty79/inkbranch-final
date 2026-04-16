"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import type {
  CatalogWorld,
  LibraryBook,
  ReaderChapter,
  ReaderChapterViewpoint,
  ReaderChapterViewpointLens,
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
const READING_ACTIVITY_PING_INTERVAL_MS = 30_000;
const READING_ACTIVITY_MAX_SECONDS_PER_PING = 45;
const MAX_VIEWPOINT_DIRECTION_INPUT_LENGTH = 1600;
const ALL_GENRES_FILTER_VALUE = "__ALL__";

const VIEWPOINT_LENS_OPTIONS: Array<{
  lens: ReaderChapterViewpointLens;
  label: string;
  description: string;
}> = [
  {
    lens: "MOMENT",
    label: "Moment",
    description: "Short emotional snapshot of this chapter.",
  },
  {
    lens: "THREAD",
    label: "Thread",
    description: "Longer side story that deepens chapter events.",
  },
  {
    lens: "SPINOFF",
    label: "Spinoff Seed",
    description: "Largest cut with momentum for a future standalone.",
  },
];
const VIEWPOINT_CHARACTER_TITLE_PREFIXES = new Set([
  "lady",
  "lord",
  "sir",
  "madam",
  "dame",
  "captain",
  "commander",
  "master",
  "mistress",
  "queen",
  "king",
  "prince",
  "princess",
  "duke",
  "duchess",
  "baron",
  "baroness",
  "count",
  "countess",
  "mr",
  "mrs",
  "ms",
  "dr",
]);

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

function getGenreLabel(genre: string | null | undefined) {
  const trimmed = genre?.trim();
  return trimmed ? trimmed : "Uncategorized";
}

function normalizeSearchValue(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function toLibraryBookSearchText(book: LibraryBook) {
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

function toCatalogWorldSearchText(world: CatalogWorld) {
  return [
    world.title,
    world.slug,
    getGenreLabel(world.genre),
    world.authorName,
    world.authorEmail,
    world.premise,
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

function groupLibraryBooksByGenre(books: LibraryBook[]) {
  const groups = new Map<string, LibraryBook[]>();

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
      books: [...groupedBooks].sort((a, b) => b.addedAt.localeCompare(a.addedAt)),
    }))
    .sort((a, b) => sortGenreLabels(a.genre, b.genre));
}

function groupCatalogWorldsByGenre(worlds: CatalogWorld[]) {
  const groups = new Map<string, CatalogWorld[]>();

  for (const world of worlds) {
    const genreLabel = getGenreLabel(world.genre);
    const existing = groups.get(genreLabel);

    if (existing) {
      existing.push(world);
    } else {
      groups.set(genreLabel, [world]);
    }
  }

  return [...groups.entries()]
    .map(([genre, groupedWorlds]) => ({
      genre,
      worlds: [...groupedWorlds].sort((a, b) => a.title.localeCompare(b.title)),
    }))
    .sort((a, b) => sortGenreLabels(a.genre, b.genre));
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

function updateSessionTimestamp(
  sessions: ReaderSessionSummary[],
  sessionId: string,
  updatedAt: string,
) {
  return sessions.map((session) => {
    if (session.id !== sessionId) {
      return session;
    }

    return {
      ...session,
      updatedAt,
    };
  });
}

function describeViewpointLens(lens: ReaderChapterViewpointLens) {
  switch (lens) {
    case "THREAD":
      return "Thread";
    case "SPINOFF":
      return "Spinoff Seed";
    default:
      return "Moment";
  }
}

function toCharacterIdentityKey(name: string) {
  const normalized = name
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  if (!normalized) {
    return "";
  }

  const parts = normalized.split(" ").filter(Boolean);

  if (parts.length === 0) {
    return "";
  }

  if (parts.length >= 2 && VIEWPOINT_CHARACTER_TITLE_PREFIXES.has(parts[0])) {
    return parts.slice(1).join(" ");
  }

  return parts.join(" ");
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
  const [isChapterContinuationLocked, setIsChapterContinuationLocked] = useState(false);
  const [isGeneratingViewpoint, setIsGeneratingViewpoint] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [librarySearchInput, setLibrarySearchInput] = useState("");
  const [libraryGenreFilter, setLibraryGenreFilter] = useState(
    ALL_GENRES_FILTER_VALUE,
  );
  const [catalogSearchInput, setCatalogSearchInput] = useState("");
  const [catalogGenreFilter, setCatalogGenreFilter] = useState(
    ALL_GENRES_FILTER_VALUE,
  );
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(
    initialActiveSession?.chapters[initialActiveSession.chapters.length - 1]?.id ??
      null,
  );
  const [selectedViewpointId, setSelectedViewpointId] = useState<string | null>(null);
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);
  const [selectedChapterPages, setSelectedChapterPages] = useState<string[]>([]);
  const [viewpointCharacterName, setViewpointCharacterName] = useState("");
  const [viewpointLens, setViewpointLens] =
    useState<ReaderChapterViewpointLens>("MOMENT");
  const [viewpointDirectionInput, setViewpointDirectionInput] = useState("");
  const [readerViewport, setReaderViewport] = useState({ width: 0, height: 0 });
  const readerPageBodyRef = useRef<HTMLDivElement | null>(null);
  const readerPageTextRef = useRef<HTMLParagraphElement | null>(null);
  const previousSelectedChapterIdRef = useRef<string | null>(null);

  const libraryGenreFilterOptions = useMemo(
    () =>
      [...new Set(books.map((book) => getGenreLabel(book.genre)))].sort(
        sortGenreLabels,
      ),
    [books],
  );
  const catalogGenreFilterOptions = useMemo(
    () =>
      [...new Set(catalogWorlds.map((world) => getGenreLabel(world.genre)))].sort(
        sortGenreLabels,
      ),
    [catalogWorlds],
  );
  const filteredLibraryBooks = useMemo(() => {
    const normalizedSearch = normalizeSearchValue(librarySearchInput);

    return books.filter((book) => {
      if (
        libraryGenreFilter !== ALL_GENRES_FILTER_VALUE &&
        getGenreLabel(book.genre) !== libraryGenreFilter
      ) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return toLibraryBookSearchText(book).includes(normalizedSearch);
    });
  }, [books, libraryGenreFilter, librarySearchInput]);
  const filteredCatalogWorlds = useMemo(() => {
    const normalizedSearch = normalizeSearchValue(catalogSearchInput);

    return catalogWorlds.filter((world) => {
      if (
        catalogGenreFilter !== ALL_GENRES_FILTER_VALUE &&
        getGenreLabel(world.genre) !== catalogGenreFilter
      ) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return toCatalogWorldSearchText(world).includes(normalizedSearch);
    });
  }, [catalogGenreFilter, catalogSearchInput, catalogWorlds]);
  const groupedLibraryBooks = useMemo(
    () => groupLibraryBooksByGenre(filteredLibraryBooks),
    [filteredLibraryBooks],
  );
  const groupedCatalogWorlds = useMemo(
    () => groupCatalogWorldsByGenre(filteredCatalogWorlds),
    [filteredCatalogWorlds],
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
  const selectedViewpoint =
    selectedChapter?.viewpoints.find((viewpoint) => viewpoint.id === selectedViewpointId) ??
    null;
  const selectedViewpointCharacterIdentityKey = toCharacterIdentityKey(
    viewpointCharacterName,
  );
  const duplicateViewpointForSelectedCharacter =
    selectedChapter?.viewpoints.find(
      (viewpoint) =>
        toCharacterIdentityKey(viewpoint.characterName) ===
        selectedViewpointCharacterIdentityKey,
    ) ?? null;
  const hasDuplicateViewpointForSelectedCharacter = Boolean(
    selectedViewpointCharacterIdentityKey && duplicateViewpointForSelectedCharacter,
  );
  const selectedChapterIndex = selectedChapter
    ? activeSession?.chapters.findIndex((chapter) => chapter.id === selectedChapter.id) ?? -1
    : -1;
  const hasExistingContinuationFromSelectedChapter = Boolean(
    activeSession &&
      selectedChapterIndex >= 0 &&
      selectedChapterIndex < activeSession.chapters.length - 1,
  );
  const continuationRequiresUnlock = hasExistingContinuationFromSelectedChapter;
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
      (!continuationRequiresUnlock || !isChapterContinuationLocked) &&
      !isGeneratingChapter &&
      !isGeneratingViewpoint &&
      !isLoadingSession,
  );
  const activeSessionId = activeSession?.session.id ?? null;

  useEffect(() => {
    if (!activeSession) {
      setSelectedChapterId(null);
      setSelectedViewpointId(null);
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
      setSelectedViewpointId(null);
      setSelectedPageIndex(0);
    }
  }, [activeSession, selectedChapterId]);

  useEffect(() => {
    const currentChapterId = selectedChapter?.id ?? null;

    if (previousSelectedChapterIdRef.current === currentChapterId) {
      return;
    }

    previousSelectedChapterIdRef.current = currentChapterId;

    if (!selectedChapter) {
      setSelectedViewpointId(null);
      setViewpointCharacterName("");
      setViewpointDirectionInput("");
      return;
    }

    setSelectedViewpointId(null);
    setViewpointCharacterName(selectedChapter.characterCandidates[0] ?? "");
    setViewpointDirectionInput("");
    setViewpointLens("MOMENT");
  }, [selectedChapter]);

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
    setSelectedPageIndex(0);
  }, [selectedChapterId]);

  useEffect(() => {
    if (!activeSession || !selectedChapter) {
      setIsChapterContinuationLocked(false);
      return;
    }

    if (hasExistingContinuationFromSelectedChapter) {
      setIsChapterContinuationLocked(true);
    } else {
      setIsChapterContinuationLocked(false);
    }
  }, [activeSession, selectedChapter, hasExistingContinuationFromSelectedChapter]);

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

  useEffect(() => {
    if (!activeSessionId || typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    let lastPingAt = Date.now();

    const sendActivityPing = (secondsSpent: number) => {
      if (secondsSpent <= 0) {
        return;
      }

      void fetch("/api/reader/activity", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: activeSessionId,
          secondsSpent,
        }),
        keepalive: true,
      }).catch(() => {
        // Ignore ping failures; this is best-effort telemetry.
      });
    };

    const flushElapsedTime = (allowWhileHidden: boolean) => {
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - lastPingAt) / 1000);
      lastPingAt = now;

      if (elapsedSeconds <= 0) {
        return;
      }

      if (!allowWhileHidden && document.visibilityState !== "visible") {
        return;
      }

      sendActivityPing(Math.min(elapsedSeconds, READING_ACTIVITY_MAX_SECONDS_PER_PING));
    };

    const intervalId = window.setInterval(() => {
      flushElapsedTime(false);
    }, READING_ACTIVITY_PING_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushElapsedTime(true);
        return;
      }

      lastPingAt = Date.now();
    };

    const handlePageHide = () => {
      flushElapsedTime(true);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      flushElapsedTime(true);
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [activeSessionId]);

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
      setSelectedViewpointId(null);
      setSelectedPageIndex(0);
      setDirectionInput("");
      setViewpointDirectionInput("");
      setViewpointLens("MOMENT");
      setViewpointCharacterName(
        readingSession.chapters[readingSession.chapters.length - 1]?.characterCandidates[0] ??
          "",
      );

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
      setSelectedViewpointId(null);
      setSelectedPageIndex(0);
      setDirectionInput("");
      setViewpointDirectionInput("");
      setViewpointLens("MOMENT");
      setViewpointCharacterName(
        payload.session.chapters[payload.session.chapters.length - 1]?.characterCandidates[0] ??
          "",
      );
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

    if (continuationRequiresUnlock && isChapterContinuationLocked) {
      setMessage({
        type: "error",
        text: "Chapter continuation is locked. Unlock it before generating the next chapter.",
      });
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
      setSelectedViewpointId(null);
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

  async function handleGenerateViewpoint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeSession || !selectedChapter) {
      return;
    }

    const characterName = viewpointCharacterName.trim();

    if (!characterName) {
      setMessage({
        type: "error",
        text: "Choose or enter a character name before generating a viewpoint.",
      });
      return;
    }

    const requestedCharacterKey = toCharacterIdentityKey(characterName);
    const existingViewpoint = selectedChapter.viewpoints.find(
      (viewpoint) =>
        toCharacterIdentityKey(viewpoint.characterName) === requestedCharacterKey,
    );

    if (existingViewpoint) {
      setMessage({
        type: "error",
        text: `A viewpoint for ${existingViewpoint.characterName} already exists in this chapter. Choose a different character.`,
      });
      return;
    }

    setIsGeneratingViewpoint(true);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/reader/sessions/${activeSession.session.id}/chapters/${selectedChapter.id}/viewpoints`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            characterName,
            lens: viewpointLens,
            directionInput: viewpointDirectionInput.trim() || undefined,
          }),
        },
      );

      const payload = (await response.json().catch(() => null)) as
        | {
            viewpoint?: ReaderChapterViewpoint;
            sessionUpdatedAt?: string;
            error?: string;
          }
        | null;

      if (!response.ok || !payload?.viewpoint || !payload.sessionUpdatedAt) {
        throw new Error(payload?.error ?? "Could not generate chapter viewpoint.");
      }

      const { viewpoint, sessionUpdatedAt } = payload;

      setActiveSession((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          session: {
            ...current.session,
            updatedAt: sessionUpdatedAt,
          },
          chapters: current.chapters.map((chapter) => {
            if (chapter.id !== selectedChapter.id) {
              return chapter;
            }

            return {
              ...chapter,
              characterCandidates: chapter.characterCandidates.some(
                (name) => name.toLowerCase() === viewpoint.characterName.toLowerCase(),
              )
                ? chapter.characterCandidates
                : [viewpoint.characterName, ...chapter.characterCandidates].slice(0, 10),
              viewpoints: [...chapter.viewpoints, viewpoint],
            };
          }),
        };
      });
      setSessions((current) =>
        updateSessionTimestamp(current, activeSession.session.id, sessionUpdatedAt),
      );
      setSelectedViewpointId(viewpoint.id);
      setViewpointDirectionInput("");
      setMessage({
        type: "success",
        text: `${viewpoint.characterName}'s ${describeViewpointLens(viewpoint.lens)} viewpoint is ready.`,
      });
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Could not generate chapter viewpoint.",
      });
    } finally {
      setIsGeneratingViewpoint(false);
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
                setSelectedViewpointId(null);
                setSelectedPageIndex(0);
                setViewpointDirectionInput("");
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
                        setSelectedViewpointId(null);
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
                      {chapter.viewpoints.length > 0 ? (
                        <p className="mt-1 text-[11px] text-[var(--ink-muted)]">
                          {chapter.viewpoints.length} viewpoint
                          {chapter.viewpoints.length === 1 ? "" : "s"}
                        </p>
                      ) : null}
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
                        setSelectedViewpointId(null);
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
                        setSelectedViewpointId(null);
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">How should the next chapter go?</p>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                continuationRequiresUnlock && isChapterContinuationLocked
                  ? "border-amber-700/45 bg-amber-100/70 text-amber-900"
                  : continuationRequiresUnlock
                    ? "border-emerald-700/40 bg-emerald-100/70 text-emerald-900"
                  : "border-emerald-700/40 bg-emerald-100/70 text-emerald-900"
              }`}
            >
              {continuationRequiresUnlock
                ? isChapterContinuationLocked
                  ? "Locked"
                  : "Unlocked"
                : "No Lock Needed"}
            </span>
          </div>
          <p className="text-xs text-[var(--ink-muted)]">
            {continuationRequiresUnlock && isChapterContinuationLocked
              ? "Lock is on by default to prevent accidental chapter regeneration. Unlock only when you are ready to continue."
              : !continuationRequiresUnlock
                ? "This is a brand-new continuation point, so no unlock is required."
              : !latestChapter
              ? "Waiting for chapter 1..."
              : !isLatestChapterSelected
                ? "Select the latest chapter in the list to continue the book."
                : !isAtEndOfChapter
                  ? "Turn to the last page of this chapter to enable generation."
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
            disabled={isGeneratingChapter || isLoadingSession || isGeneratingViewpoint}
          />

          <button
            type="button"
            onClick={() =>
              setIsChapterContinuationLocked((current) => !current)
            }
            disabled={
              !continuationRequiresUnlock ||
              isGeneratingChapter ||
              isGeneratingViewpoint ||
              isLoadingSession
            }
            className={`w-full rounded-full border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 ${
              isChapterContinuationLocked
                ? "border-amber-700/45 bg-amber-100/70 text-amber-900 hover:bg-amber-100"
                : "border-emerald-700/40 bg-emerald-100/70 text-emerald-900 hover:bg-emerald-100"
            }`}
          >
            {!continuationRequiresUnlock
              ? "Lock Not Required For This Next Chapter"
              : isChapterContinuationLocked
                ? "Unlock Chapter Continuation"
                : "Relock Chapter Continuation"}
          </button>

          <button
            type="submit"
            disabled={!canGenerateNextChapter}
            className="parchment-button rounded-full px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isGeneratingChapter
              ? "Generating Next Chapter..."
              : isGeneratingViewpoint
                ? "Generating Viewpoint..."
              : isLoadingSession
                ? "Loading..."
                : continuationRequiresUnlock && isChapterContinuationLocked
                  ? "Unlock To Continue"
                : !canGenerateNextChapter
                  ? "Reach Chapter End To Continue"
                  : "Generate Next Chapter"}
          </button>
        </form>

        {selectedChapter ? (
          <section className="space-y-4 rounded-lg border border-[var(--parchment-border)] bg-[var(--parchment-soft)] px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">Character Viewpoints</p>
              <p className="text-xs text-[var(--ink-muted)]">
                Alternate perspectives live here. Your main chapter reader above stays unchanged.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedViewpointId(null);
                }}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  !selectedViewpoint
                    ? "border-[var(--focus-border)] bg-white/75 text-[var(--ink)]"
                    : "border-[var(--parchment-border)] text-[var(--ink)] hover:bg-white/65"
                }`}
              >
                No Viewpoint Selected
              </button>
              {selectedChapter.viewpoints.map((viewpoint) => (
                <button
                  key={viewpoint.id}
                  type="button"
                  onClick={() => {
                    setSelectedViewpointId(viewpoint.id);
                  }}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    selectedViewpoint?.id === viewpoint.id
                      ? "border-[var(--focus-border)] bg-white/75 text-[var(--ink)]"
                      : "border-[var(--parchment-border)] text-[var(--ink)] hover:bg-white/65"
                  }`}
                >
                  {viewpoint.characterName} ({describeViewpointLens(viewpoint.lens)})
                </button>
              ))}
            </div>

            <form className="space-y-3" onSubmit={handleGenerateViewpoint}>
              {selectedChapter.characterCandidates.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selectedChapter.characterCandidates.map((name) => (
                    (() => {
                      const candidateKey = toCharacterIdentityKey(name);
                      const hasExistingViewpoint = selectedChapter.viewpoints.some(
                        (viewpoint) =>
                          toCharacterIdentityKey(viewpoint.characterName) === candidateKey,
                      );

                      return (
                        <button
                          key={`${selectedChapter.id}-${name}`}
                          type="button"
                          onClick={() => setViewpointCharacterName(name)}
                          disabled={hasExistingViewpoint}
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                            viewpointCharacterName.trim().toLowerCase() === name.toLowerCase()
                              ? "border-[var(--focus-border)] bg-white/75 text-[var(--ink)]"
                              : "border-[var(--parchment-border)] text-[var(--ink-muted)] hover:bg-white/65"
                          } ${hasExistingViewpoint ? "cursor-not-allowed opacity-60" : ""}`}
                          title={
                            hasExistingViewpoint
                              ? "Viewpoint already exists for this character in this chapter."
                              : undefined
                          }
                        >
                          {name}
                          {hasExistingViewpoint ? " (already used)" : ""}
                        </button>
                      );
                    })()
                  ))}
                </div>
              ) : null}

              <div className="grid gap-2 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-[var(--ink-muted)] uppercase">
                    Character Name
                  </span>
                  <input
                    value={viewpointCharacterName}
                    onChange={(event) => setViewpointCharacterName(event.target.value)}
                    placeholder="Choose a character from this chapter..."
                    maxLength={80}
                    className="parchment-input w-full rounded-lg px-3 py-2 text-sm outline-none"
                    disabled={isGeneratingViewpoint || isLoadingSession || isGeneratingChapter}
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold text-[var(--ink-muted)] uppercase">
                    Viewpoint Length
                  </span>
                  <select
                    value={viewpointLens}
                    onChange={(event) =>
                      setViewpointLens(event.target.value as ReaderChapterViewpointLens)
                    }
                    className="parchment-input w-full rounded-lg px-3 py-2 text-sm outline-none"
                    disabled={isGeneratingViewpoint || isLoadingSession || isGeneratingChapter}
                  >
                    {VIEWPOINT_LENS_OPTIONS.map((option) => (
                      <option key={option.lens} value={option.lens}>
                        {option.label} - {option.description}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="space-y-1">
                <span className="text-xs font-semibold text-[var(--ink-muted)] uppercase">
                  Optional Direction
                </span>
                <textarea
                  value={viewpointDirectionInput}
                  onChange={(event) => setViewpointDirectionInput(event.target.value)}
                  placeholder="Optional: ask for tone, focus, or hidden motives to explore..."
                  className="parchment-input min-h-[90px] w-full rounded-lg px-3 py-2 text-sm outline-none"
                  maxLength={MAX_VIEWPOINT_DIRECTION_INPUT_LENGTH}
                  disabled={isGeneratingViewpoint || isLoadingSession || isGeneratingChapter}
                />
              </label>

              {hasDuplicateViewpointForSelectedCharacter ? (
                <p className="text-xs text-rose-800">
                  A viewpoint for {duplicateViewpointForSelectedCharacter?.characterName} already
                  exists in this chapter. Pick another character.
                </p>
              ) : null}

              <button
                type="submit"
                disabled={
                  !selectedChapter ||
                  !viewpointCharacterName.trim() ||
                  hasDuplicateViewpointForSelectedCharacter ||
                  isGeneratingViewpoint ||
                  isLoadingSession ||
                  isGeneratingChapter
                }
                className="rounded-full border border-[var(--parchment-border)] px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:bg-white/65 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isGeneratingViewpoint
                  ? "Generating Viewpoint..."
                  : "Generate Character Viewpoint"}
              </button>
            </form>

            {selectedViewpoint ? (
              <article className="rounded-lg border border-[var(--parchment-border)] bg-white/45 px-4 py-4">
                <p className="text-xs tracking-[0.12em] text-[var(--ink-muted)] uppercase">
                  Chapter {selectedViewpoint.chapterNumber} | {describeViewpointLens(selectedViewpoint.lens)}
                </p>
                <h4 className="mt-1 text-lg font-semibold">{selectedViewpoint.title}</h4>
                <p className="mt-1 text-xs text-[var(--ink-muted)]">
                  {selectedViewpoint.characterName} viewpoint | Generated {formatDate(selectedViewpoint.createdAt)}
                </p>
                <div className="mt-3 max-h-[26rem] overflow-y-auto pr-1">
                  <p className="whitespace-pre-wrap text-sm leading-7 text-[var(--ink)]">
                    {selectedViewpoint.content}
                  </p>
                </div>
              </article>
            ) : (
              <p className="rounded-lg border border-[var(--parchment-border)] bg-white/45 px-3 py-3 text-sm text-[var(--ink-muted)]">
                Select a saved viewpoint above, or generate one for this chapter.
              </p>
            )}
          </section>
        ) : null}
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

          <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
            <label className="space-y-1 text-sm">
              <span className="parchment-label block text-sm font-medium">
                Search shelf
              </span>
              <input
                type="text"
                value={librarySearchInput}
                onChange={(event) => setLibrarySearchInput(event.target.value)}
                placeholder="Title, genre, author, premise..."
                className="parchment-input w-full rounded-lg px-3 py-2 text-sm outline-none"
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="parchment-label block text-sm font-medium">Genre</span>
              <select
                value={libraryGenreFilter}
                onChange={(event) => setLibraryGenreFilter(event.target.value)}
                className="parchment-input w-full rounded-lg px-3 py-2 text-sm outline-none"
              >
                <option value={ALL_GENRES_FILTER_VALUE}>All genres</option>
                {libraryGenreFilterOptions.map((genre) => (
                  <option key={genre} value={genre}>
                    {genre}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {books.length === 0 ? (
              <p className="rounded-lg border border-[var(--parchment-border)] bg-[var(--parchment-soft)] px-3 py-3 text-sm text-[var(--ink-muted)] md:col-span-2 xl:col-span-3">
                No books in library yet.
              </p>
            ) : filteredLibraryBooks.length === 0 ? (
              <p className="rounded-lg border border-[var(--parchment-border)] bg-[var(--parchment-soft)] px-3 py-3 text-sm text-[var(--ink-muted)] md:col-span-2 xl:col-span-3">
                No library books match your search or genre filter.
              </p>
            ) : (
              groupedLibraryBooks.map((group) => (
                <div key={group.genre} className="md:col-span-2 xl:col-span-3">
                  <p className="mb-3 text-xs tracking-[0.12em] text-[var(--ink-muted)] uppercase">
                    {group.genre}
                  </p>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {group.books.map((book) => (
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
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="parchment-card rounded-2xl p-5 shadow-lg">
          <h4 className="text-xl font-semibold">Add From Catalog</h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
            <label className="space-y-1 text-sm">
              <span className="parchment-label block text-sm font-medium">
                Search catalog
              </span>
              <input
                type="text"
                value={catalogSearchInput}
                onChange={(event) => setCatalogSearchInput(event.target.value)}
                placeholder="Title, genre, author, premise..."
                className="parchment-input w-full rounded-lg px-3 py-2 text-sm outline-none"
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="parchment-label block text-sm font-medium">Genre</span>
              <select
                value={catalogGenreFilter}
                onChange={(event) => setCatalogGenreFilter(event.target.value)}
                className="parchment-input w-full rounded-lg px-3 py-2 text-sm outline-none"
              >
                <option value={ALL_GENRES_FILTER_VALUE}>All genres</option>
                {catalogGenreFilterOptions.map((genre) => (
                  <option key={genre} value={genre}>
                    {genre}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {catalogWorlds.length === 0 ? (
              <p className="rounded-lg border border-[var(--parchment-border)] bg-[var(--parchment-soft)] px-3 py-3 text-sm text-[var(--ink-muted)] md:col-span-2 xl:col-span-3">
                No additional books available to add.
              </p>
            ) : filteredCatalogWorlds.length === 0 ? (
              <p className="rounded-lg border border-[var(--parchment-border)] bg-[var(--parchment-soft)] px-3 py-3 text-sm text-[var(--ink-muted)] md:col-span-2 xl:col-span-3">
                No catalog books match your search or genre filter.
              </p>
            ) : (
              groupedCatalogWorlds.map((group) => (
                <div key={group.genre} className="md:col-span-2 xl:col-span-3">
                  <p className="mb-3 text-xs tracking-[0.12em] text-[var(--ink-muted)] uppercase">
                    {group.genre}
                  </p>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {group.worlds.map((world) => (
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
                    ))}
                  </div>
                </div>
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
