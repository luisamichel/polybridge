"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  BookOpen,
  Filter,
  Loader2,
  Search,
} from "lucide-react";
import {
  getErrorPatterns,
  getErrors,
  type ErrorEntry,
  type ErrorPatterns,
} from "@/lib/api";

const ARCHIVE_STORAGE_KEY = "polybridge-archived-errors";

const CATEGORY_FILTERS = [
  { id: "all", label: "All" },
  { id: "grammar", label: "Grammar" },
  { id: "spelling", label: "Spelling" },
  { id: "vocab", label: "Vocabulary" },
  { id: "false_friend", label: "False friends" },
  { id: "gender", label: "Gender" },
] as const;

type CategoryFilter = (typeof CATEGORY_FILTERS)[number]["id"];

function formatDate(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatRelativeDate(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "recently";
  }

  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return formatDate(timestamp);
}

function categoryLabel(category: string | null): string {
  if (!category) return "Other";
  return category.replace(/_/g, " ");
}

function categoryBadgeClass(category: string | null): string {
  switch (category) {
    case "grammar":
      return "bg-accent-cyan/15 text-accent-cyan ring-accent-cyan/25";
    case "spelling":
      return "bg-red-400/15 text-red-300 ring-red-400/25";
    case "vocab":
      return "bg-accent/15 text-accent-violet ring-accent/25";
    case "false_friend":
      return "bg-accent-violet/15 text-accent-violet ring-accent-violet/25";
    case "gender":
      return "bg-accent-teal/15 text-accent-teal ring-accent-teal/25";
    default:
      return "bg-zinc-500/15 text-zinc-400 ring-zinc-500/25";
  }
}

function loadArchivedIds(): Set<number> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(ARCHIVE_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as number[];
    return new Set(parsed);
  } catch {
    return new Set();
  }
}

function saveArchivedIds(ids: Set<number>) {
  localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify([...ids]));
}

function PatternStatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface/80 px-4 py-3 backdrop-blur-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 truncate text-xs text-muted/80">{hint}</p>
      ) : null}
    </div>
  );
}

function NotebookSkeleton() {
  return (
    <div className="animate-pulse space-y-6 px-6 py-8 sm:px-10">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="space-y-2">
          <div className="h-3 w-16 rounded bg-zinc-800/60" />
          <div className="h-5 w-3/4 max-w-md rounded bg-zinc-800/50" />
          <div className="h-4 w-1/2 max-w-xs rounded bg-zinc-800/40" />
        </div>
      ))}
    </div>
  );
}

function ErrorRow({
  entry,
  archived,
  onToggleArchive,
}: {
  entry: ErrorEntry;
  archived: boolean;
  onToggleArchive: (id: number) => void;
}) {
  return (
    <article className="group relative border-b border-[#d4cbb8]/80 pb-6 last:border-b-0 last:pb-0">
      <div className="flex items-start justify-between gap-4">
        <time
          className={`shrink-0 text-sm font-medium text-red-400/90 font-notebook`}
        >
          {formatDate(entry.timestamp)}
        </time>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => onToggleArchive(entry.id)}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-[#5c5346] opacity-0 transition-all duration-200 hover:bg-[#ddd4c0] group-hover:opacity-100"
            aria-label={archived ? "Restore error" : "Archive error"}
          >
            {archived ? (
              <>
                <ArchiveRestore className="h-3.5 w-3.5" />
                Restore
              </>
            ) : (
              <>
                <Archive className="h-3.5 w-3.5" />
                Archive
              </>
            )}
          </button>

          {entry.category ? (
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ${categoryBadgeClass(entry.category)}`}
            >
              {categoryLabel(entry.category)}
            </span>
          ) : null}
        </div>
      </div>

      <p
        className={`mt-2 text-xl leading-snug text-[#3d3428] font-notebook`}
      >
        <span className="text-red-500/80 line-through">{entry.mistake}</span>
        <span className="mx-2 text-[#8b7355]">→</span>
        <span className="font-semibold text-[#2a2218]">{entry.correction}</span>
      </p>

      {entry.notes ? (
        <p
          className={`mt-1.5 text-base leading-relaxed text-[#5c5346] font-notebook`}
        >
          {entry.notes}
        </p>
      ) : null}

      {(entry.context || entry.interference_lang) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#7a6f5e]">
          {entry.context ? (
            <p>
              context:{" "}
              <span className="rounded bg-accent/20 px-1.5 py-0.5 font-medium text-accent-violet">
                {entry.context}
              </span>
            </p>
          ) : null}
          {entry.interference_lang &&
          !["none", "unknown", ""].includes(entry.interference_lang) ? (
            <p>
              from:{" "}
              <span className="font-medium text-[#4a4035]">
                {entry.interference_lang}
              </span>
            </p>
          ) : null}
        </div>
      )}
    </article>
  );
}

export default function ErrorNotebookPage() {
  const [errors, setErrors] = useState<ErrorEntry[] | null>(null);
  const [patterns, setPatterns] = useState<ErrorPatterns | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [archivedIds, setArchivedIds] = useState<Set<number>>(new Set());
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");

  useEffect(() => {
    setArchivedIds(loadArchivedIds());
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setFetchFailed(false);

      const [errorsData, patternsData] = await Promise.all([
        getErrors(),
        getErrorPatterns(),
      ]);

      if (cancelled) return;

      if (errorsData === null && patternsData === null) {
        setFetchFailed(true);
      }

      setErrors(errorsData ?? []);
      setPatterns(patternsData);
      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const toggleArchive = useCallback((id: number) => {
    setArchivedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      saveArchivedIds(next);
      return next;
    });
  }, []);

  const activeErrors = useMemo(
    () => (errors ?? []).filter((entry) => !archivedIds.has(entry.id)),
    [errors, archivedIds],
  );

  const archivedErrors = useMemo(
    () => (errors ?? []).filter((entry) => archivedIds.has(entry.id)),
    [errors, archivedIds],
  );

  const visibleErrors = tab === "active" ? activeErrors : archivedErrors;

  const filteredErrors = useMemo(() => {
    const query = search.trim().toLowerCase();

    return visibleErrors.filter((entry) => {
      const matchesCategory =
        categoryFilter === "all" || entry.category === categoryFilter;

      if (!matchesCategory) return false;
      if (!query) return true;

      const haystack = [
        entry.mistake,
        entry.correction,
        entry.notes,
        entry.context,
        entry.category,
        entry.interference_lang,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [visibleErrors, search, categoryFilter]);

  const lastUpdated = errors?.[0]?.timestamp;

  const patternStats = useMemo(() => {
    const total = errors?.length ?? 0;
    const topCategory = patterns?.by_category[0];
    const repeated = patterns?.repeated_mistakes.length ?? 0;
    const topInterference = patterns?.by_interference_lang[0];

    return {
      total: String(total),
      topCategory: topCategory
        ? `${categoryLabel(topCategory.category)} (${topCategory.count})`
        : "—",
      repeated: String(repeated),
      interference: topInterference
        ? `${topInterference.interference_lang} (${topInterference.count})`
        : "None yet",
    };
  }, [errors, patterns]);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent-teal/70">
              Your learning journal
            </p>
            <h1
              className={`mt-1 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl font-notebook`}
            >
              Errors Notebook
            </h1>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">
              Every slip is a stepping stone. Browse, revisit, and learn from
              your past mistakes.
            </p>
          </div>

          {!loading && errors !== null ? (
            <div className="shrink-0 text-right text-sm">
              <p>
                <span className="font-semibold text-accent-cyan">
                  {activeErrors.length} active
                </span>
                {archivedErrors.length > 0 ? (
                  <span className="text-muted">
                    {" "}
                    · {archivedErrors.length} archived
                  </span>
                ) : null}
              </p>
              {lastUpdated ? (
                <p className="mt-0.5 text-xs text-muted">
                  last updated {formatRelativeDate(lastUpdated)}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Pattern stat cards */}
        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-[88px] animate-pulse rounded-xl border border-border-subtle bg-surface/60"
              />
            ))
          ) : (
            <>
              <PatternStatCard label="Total errors" value={patternStats.total} />
              <PatternStatCard
                label="Top category"
                value={patternStats.topCategory.split(" ")[0]}
                hint={patternStats.topCategory}
              />
              <PatternStatCard
                label="Repeated patterns"
                value={patternStats.repeated}
                hint="Mistakes made more than once"
              />
              <PatternStatCard
                label="Interference"
                value={
                  patternStats.interference === "None yet"
                    ? "—"
                    : patternStats.interference.split(" ")[0]
                }
                hint={patternStats.interference}
              />
            </>
          )}
        </section>

        {/* Tabs + search + filters */}
        <div className="mb-5 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setTab("active")}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === "active"
                  ? "bg-gradient-brand text-white shadow-md shadow-accent/20"
                  : "bg-surface text-muted hover:bg-surface-hover hover:text-foreground"
              }`}
            >
              Active ({activeErrors.length})
            </button>
            <button
              type="button"
              onClick={() => setTab("archived")}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === "archived"
                  ? "bg-gradient-brand text-white shadow-md shadow-accent/20"
                  : "bg-surface text-muted hover:bg-surface-hover hover:text-foreground"
              }`}
            >
              Archived ({archivedErrors.length})
            </button>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search mistakes, corrections, notes..."
                className="w-full rounded-xl border border-border-subtle bg-surface py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted/70 focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Filter className="hidden h-4 w-4 text-muted sm:block" />
              {CATEGORY_FILTERS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setCategoryFilter(id)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    categoryFilter === id
                      ? "bg-accent/20 text-accent-violet ring-1 ring-accent/30"
                      : "text-muted hover:bg-surface-hover hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Notebook */}
        <div className="relative">
          {/* Sticky tabs */}
          <div className="pointer-events-none absolute -top-1 left-8 flex gap-3 sm:left-12">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="h-5 w-8 rounded-t-sm bg-accent/80 shadow-sm"
                style={{ transform: `rotate(${index === 1 ? 0 : index === 0 ? -2 : 2}deg)` }}
              />
            ))}
          </div>

          <div className="relative overflow-hidden rounded-2xl shadow-2xl shadow-black/40 ring-1 ring-[#c9bfaa]/40">
            {/* Spiral holes */}
            <div className="absolute bottom-6 left-0 top-6 flex w-8 flex-col justify-around py-2">
              {Array.from({ length: 12 }).map((_, index) => (
                <div
                  key={index}
                  className="mx-auto h-3 w-3 rounded-full bg-[#1a1520] ring-2 ring-[#b8ae98]"
                />
              ))}
            </div>

            <div className="min-h-[320px] bg-[#ebe5d4] pl-10 sm:pl-12">
              {loading ? (
                <NotebookSkeleton />
              ) : fetchFailed ? (
                <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                  <BookOpen className="mb-4 h-10 w-10 text-[#8b7355]" />
                  <p
                    className={`text-2xl font-medium text-[#3d3428] font-notebook`}
                  >
                    Couldn&apos;t reach the server
                  </p>
                  <p className="mt-2 max-w-sm text-sm text-[#7a6f5e]">
                    Make sure the API is running at localhost:8000, then refresh
                    this page.
                  </p>
                </div>
              ) : filteredErrors.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                  <BookOpen className="mb-4 h-10 w-10 text-[#8b7355]" />
                  <p
                    className={`text-2xl font-medium text-[#3d3428] font-notebook`}
                  >
                    {tab === "archived"
                      ? "No archived errors yet"
                      : errors?.length === 0
                        ? "No errors recorded yet"
                        : "Nothing matches your filters"}
                  </p>
                  <p className="mt-2 max-w-sm text-sm text-[#7a6f5e]">
                    {tab === "archived"
                      ? "Hover over an error and click Archive to move it here."
                      : errors?.length === 0
                        ? "Start a chat session — every correction you receive will land here automatically."
                        : "Try a different search term or category filter."}
                  </p>
                </div>
              ) : (
                <div className="space-y-6 px-6 py-8 sm:px-10">
                  {filteredErrors.map((entry) => (
                    <ErrorRow
                      key={entry.id}
                      entry={entry}
                      archived={archivedIds.has(entry.id)}
                      onToggleArchive={toggleArchive}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <p className="mt-4 flex items-center justify-center gap-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin text-accent" />
            Loading your notebook...
          </p>
        ) : null}
      </div>
    </div>
  );
}
