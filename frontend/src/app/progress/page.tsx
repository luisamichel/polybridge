"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, Loader2, Repeat } from "lucide-react";
import {
  getErrorPatterns,
  getSessions,
  type ErrorPatterns,
  type Session,
} from "@/lib/api";

function formatSessionDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    return dateStr.slice(0, 10);
  }
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function categoryLabel(category: string): string {
  return category.replace(/_/g, " ");
}

function interferenceLangCode(lang: string): string {
  const normalized = lang.trim().toUpperCase();
  return normalized.length <= 3 ? normalized : normalized.slice(0, 2);
}

function StatCard({
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

function computeStats(patterns: ErrorPatterns | null, sessions: Session[] | null) {
  const byCategory = patterns?.by_category ?? [];
  const byLang = patterns?.by_interference_lang ?? [];
  const sessionList = sessions ?? [];

  const totalErrors = byCategory.reduce((sum, row) => sum + row.count, 0);

  const topCategory = byCategory[0];
  const topCategoryLabel = topCategory
    ? `${categoryLabel(topCategory.category)} (${topCategory.count})`
    : "—";
  const topCategoryValue = topCategory
    ? categoryLabel(topCategory.category).split(" ")[0]
    : "—";

  const topInterference = byLang.find(
    (row) =>
      !["none", "unknown", ""].includes(
        row.interference_lang.trim().toLowerCase(),
      ),
  );
  const topInterferenceLabel = topInterference
    ? `${interferenceLangCode(topInterference.interference_lang)} (${topInterference.count})`
    : "No interference tracked yet";
  const topInterferenceValue = topInterference
    ? interferenceLangCode(topInterference.interference_lang)
    : "—";

  return {
    totalErrors: String(totalErrors),
    topCategoryValue,
    topCategoryHint: topCategory ? topCategoryLabel : "No errors logged yet",
    topInterferenceValue,
    topInterferenceHint: topInterferenceLabel,
    totalSessions: String(sessionList.length),
  };
}

export default function ProgressPage() {
  const [patterns, setPatterns] = useState<ErrorPatterns | null>(null);
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const [patternsData, sessionsData] = await Promise.all([
          getErrorPatterns(),
          getSessions(),
        ]);
        if (cancelled) return;
        if (patternsData === null && sessionsData === null) {
          setLoadError(
            "Could not load progress data. Check that the API is running.",
          );
        }
        setPatterns(patternsData);
        setSessions(sessionsData);
      } catch {
        if (!cancelled) {
          setLoadError("Could not load progress data.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(
    () => computeStats(patterns, sessions),
    [patterns, sessions],
  );

  const repeatedMistakes = patterns?.repeated_mistakes ?? [];
  const sessionList = sessions ?? [];

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-6 py-8">
        <div className="mb-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent-teal/70">
            Your learning journey
          </p>
          <h1 className="mt-1 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Progress
          </h1>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">
            Sessions, error trends, and mistakes you keep repeating.
          </p>
        </div>

        {loadError && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
          >
            {loadError}
          </div>
        )}

        <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-[88px] animate-pulse rounded-xl border border-border-subtle bg-surface/60"
              />
            ))
          ) : (
            <>
              <StatCard label="Total errors" value={stats.totalErrors} />
              <StatCard
                label="Top category"
                value={stats.topCategoryValue}
                hint={stats.topCategoryHint}
              />
              <StatCard
                label="Top interference"
                value={stats.topInterferenceValue}
                hint={stats.topInterferenceHint}
              />
              <StatCard label="Total sessions" value={stats.totalSessions} />
            </>
          )}
        </section>

        <section className="mb-8">
          <div className="mb-4 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-accent-cyan" />
            <h2 className="text-lg font-semibold text-foreground">Sessions</h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-border-subtle bg-surface/60 py-12 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin text-accent" />
              Loading sessions…
            </div>
          ) : sessionList.length === 0 ? (
            <p className="rounded-xl border border-border-subtle bg-surface/60 px-4 py-8 text-center text-sm text-muted">
              No sessions yet. Start a conversation to track your progress.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {sessionList.map((session) => (
                <li
                  key={session.id}
                  className="flex flex-col gap-1 rounded-xl border border-border-subtle bg-surface/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {session.topic?.trim() || "General conversation"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {formatSessionDate(session.date)}
                    </p>
                  </div>
                  <p className="text-xs text-muted sm:text-right">
                    {session.errors_made}{" "}
                    {session.errors_made === 1 ? "error" : "errors"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <div className="mb-4 flex items-center gap-2">
            <Repeat className="h-4 w-4 text-accent-violet" />
            <h2 className="text-lg font-semibold text-foreground">
              Repeated mistakes
            </h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-border-subtle bg-surface/60 py-12 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin text-accent" />
              Loading patterns…
            </div>
          ) : repeatedMistakes.length === 0 ? (
            <p className="rounded-xl border border-border-subtle bg-surface/60 px-4 py-8 text-center text-sm text-muted">
              No repeated mistakes yet — keep practicing and we will highlight
              patterns here.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {repeatedMistakes.map((item, index) => (
                <li
                  key={`${item.mistake}-${item.correction}-${index}`}
                  className="rounded-xl border border-border-subtle bg-surface/80 px-4 py-3 text-sm"
                >
                  <span className="text-red-300/90 line-through decoration-red-400/50">
                    {item.mistake}
                  </span>
                  <span className="mx-2 text-muted">→</span>
                  <span className="text-foreground">{item.correction}</span>
                  <span className="ml-2 text-xs font-medium text-accent-cyan">
                    ({item.times}x)
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

      </div>
    </div>
  );
}
