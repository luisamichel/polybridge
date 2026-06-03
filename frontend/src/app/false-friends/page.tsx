"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Download,
  Link2,
  Loader2,
  Upload,
  ExternalLink,
  Check,
  X,
} from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { DeckTile } from "@/components/flashcards/DeckTile";
import {
  StudySession,
  type StudyCard,
} from "@/components/flashcards/StudySession";
import {
  getFalseFriendsByPair,
  getRecentDeck,
  getVocabLookups,
  getAnkiStatus,
  exportDeckToAnki,
  type FalseFriendCard,
  type FalseFriendsByPair,
  type RecentDeckCard,
  type VocabLookup,
  type AnkiStatus,
} from "@/lib/api";

type ActiveDeck = {
  sectionLabel: string;
  deckTitle: string;
  cards: StudyCard[];
};

function extractTrapMeaning(nativeAssumedMeaning: string): string {
  const match = nativeAssumedMeaning.match(/=\(([^)]+)\)/);
  return match ? match[1] : nativeAssumedMeaning;
}

function falseFriendToStudyCard(
  card: FalseFriendCard,
  index: number,
): StudyCard {
  const trap = extractTrapMeaning(card.native_assumed_meaning);

  return {
    id: `${card.native_lang}-${card.target_word}-${index}`,
    front: card.target_word,
    back: card.target_actual_meaning,
    hint: `${card.native_lang}: ${card.native_word} → ${trap}`,
    note: `'${card.target_word}' looks like '${card.native_word}' but means "${card.target_actual_meaning}" — not ${card.native_assumed_meaning}`,
  };
}

function recentToStudyCard(card: RecentDeckCard, index: number): StudyCard {
  const interference =
    card.interference_lang &&
    !["none", "unknown", ""].includes(card.interference_lang)
      ? ` · ${card.interference_lang} interference`
      : "";

  return {
    id: `recent-${index}`,
    front: card.front,
    back: card.back,
    hint: card.category
      ? `${card.category.replace(/_/g, " ")}${interference}`
      : undefined,
    note: card.note ?? undefined,
  };
}

function vocabToStudyCard(card: VocabLookup, index: number): StudyCard {
  return {
    id: `vocab-${card.id}-${index}`,
    front: card.word,
    back: card.translation || "N/A",
    note: card.notes || undefined,
  };
}

function pairDeckStyle(nativeLang: string, targetLang: string) {
  const key = `${nativeLang}-${targetLang}`;

  switch (key) {
    case "EN-FR":
      return {
        gradientClass:
          "hover:shadow-accent/15 bg-gradient-to-br from-accent/25 via-accent-muted/15 to-surface",
        subtitleClass: "text-accent-violet",
      };
    case "EN-ES":
      return {
        gradientClass:
          "hover:shadow-orange-500/10 bg-gradient-to-br from-orange-900/35 via-amber-900/15 to-surface",
        subtitleClass: "text-orange-300",
      };
    case "PT-FR":
    case "PT-ES":
      return {
        gradientClass:
          "hover:shadow-accent-teal/15 bg-gradient-to-br from-accent-teal/25 via-emerald-900/15 to-surface",
        subtitleClass: "text-accent-teal",
      };
    default:
      return {
        gradientClass:
          "hover:shadow-indigo-500/10 bg-gradient-to-br from-indigo-900/30 via-accent/10 to-surface",
        subtitleClass: "text-accent-cyan",
      };
  }
}

function ComingSoonButton({
  children,
  icon: Icon,
}: {
  children: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <button
      type="button"
      disabled
      title="Coming soon"
      className="flex cursor-not-allowed items-center gap-2 rounded-lg border border-border-subtle bg-surface/50 px-3 py-2 text-sm text-muted opacity-50"
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

function ExportButton({
  loading,
  success,
  error,
  onClick,
}: {
  loading: boolean;
  success: string | null;
  error: string | null;
  onClick: () => void;
}) {
  if (loading) {
    return (
      <button
        type="button"
        disabled
        className="flex items-center gap-1.5 rounded-full bg-surface/80 px-2.5 py-1 text-xs text-muted ring-1 ring-border-subtle"
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        Exporting...
      </button>
    );
  }

  if (success) {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-1 text-xs text-green-600 ring-1 ring-green-500/20">
        <Check className="h-3 w-3" />
        {success}
      </div>
    );
  }

  if (error) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-1 text-xs text-red-600 ring-1 ring-red-500/20 hover:bg-red-500/20"
      >
        <X className="h-3 w-3" />
        {error}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-full bg-surface/80 px-2.5 py-1 text-xs text-muted ring-1 ring-border-subtle hover:bg-surface-hover"
    >
      <ExternalLink className="h-3 w-3" />
      Anki
    </button>
  );
}

export default function FlashcardsPage() {
  const [pairs, setPairs] = useState<FalseFriendsByPair[]>([]);
  const [recentDeck, setRecentDeck] = useState<RecentDeckCard[]>([]);
  const [vocabLookups, setVocabLookups] = useState<VocabLookup[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [activeDeck, setActiveDeck] = useState<ActiveDeck | null>(null);
  const [ankiStatus, setAnkiStatus] = useState<AnkiStatus>({ connected: false });
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showExportAllModal, setShowExportAllModal] = useState(false);
  const [exportStates, setExportStates] = useState<{
    false_friends?: { loading: boolean; success: string | null; error: string | null };
    vocab?: { loading: boolean; success: string | null; error: string | null };
    mistakes?: { loading: boolean; success: string | null; error: string | null };
  }>({});

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setFetchFailed(false);

      const [pairsData, recentData, vocabData] = await Promise.all([
        getFalseFriendsByPair(),
        getRecentDeck(),
        getVocabLookups(),
      ]);

      if (cancelled) return;

      if (pairsData === null && recentData === null && vocabData === null) {
        setFetchFailed(true);
      }

      setPairs(pairsData ?? []);
      setRecentDeck(recentData ?? []);
      setVocabLookups(vocabData ?? []);
      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    async function checkAnkiStatus() {
      const status = await getAnkiStatus();
      setAnkiStatus(status);
    }

    checkAnkiStatus();
    const interval = setInterval(checkAnkiStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const recentCards = useMemo(
    () => recentDeck.map(recentToStudyCard),
    [recentDeck],
  );

  const vocabCards = useMemo(
    () => vocabLookups.map(vocabToStudyCard),
    [vocabLookups],
  );

  function openFalseFriendsDeck(deck: FalseFriendsByPair) {
    setActiveDeck({
      sectionLabel: "False friends",
      deckTitle: deck.label,
      cards: deck.cards.map(falseFriendToStudyCard),
    });
  }

  function openRecentDeck() {
    setActiveDeck({
      sectionLabel: "From your conversations",
      deckTitle: "Recent slip-ups",
      cards: recentCards,
    });
  }

  function openVocabDeck() {
    setActiveDeck({
      sectionLabel: "From your conversations",
      deckTitle: "Words I looked up",
      cards: vocabCards,
    });
  }

  async function handleExportToAnki(
    deckType: "false_friends" | "vocab" | "mistakes",
    deckName?: string
  ) {
    setExportStates((prev) => ({
      ...prev,
      [deckType]: { loading: true, success: null, error: null },
    }));

    const result = await exportDeckToAnki(deckType, deckName);

    setExportStates((prev) => ({
      ...prev,
      [deckType]: {
        loading: false,
        success: result ? `${result.added} cards added to Anki` : null,
        error: result ? null : "Failed — is Anki open?",
      },
    }));
  }

  async function handleExportAll() {
    setShowExportAllModal(false);
    
    for (const deckType of ["false_friends", "vocab", "mistakes"] as const) {
      await handleExportToAnki(deckType);
    }
  }

  if (activeDeck) {
    return (
      <StudySession
        deckTitle={activeDeck.deckTitle}
        sectionLabel={activeDeck.sectionLabel}
        cards={activeDeck.cards}
        onExit={() => setActiveDeck(null)}
      />
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent-teal/70">
              Practice &amp; review
            </p>
            <h1 className="mt-1 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Flashcards
            </h1>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">
              Pick a deck to practice. Decks sync with your Anki collection.
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 sm:items-end">
            <div className="flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-xs text-muted ring-1 ring-border-subtle">
              <span
                className={`h-2 w-2 rounded-full ${
                  ankiStatus.connected ? "bg-green-500" : "bg-red-500"
                }`}
              />
              {ankiStatus.connected ? "Anki connected" : "Anki not connected"}
            </div>
            <div className="flex flex-wrap gap-2">
              {!ankiStatus.connected ? (
                <button
                  type="button"
                  onClick={() => setShowConnectModal(true)}
                  className="flex items-center gap-2 rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm text-foreground hover:bg-surface-hover"
                >
                  <Link2 className="h-4 w-4" />
                  Connect Anki
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowExportAllModal(true)}
                  className="flex items-center gap-2 rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm text-foreground hover:bg-surface-hover"
                >
                  <ExternalLink className="h-4 w-4" />
                  Export all to Anki
                </button>
              )}
              <ComingSoonButton icon={Download}>Import .apkg</ComingSoonButton>
              <ComingSoonButton icon={Upload}>Export</ComingSoonButton>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
            <p className="mt-4 text-sm text-muted">Loading decks...</p>
          </div>
        ) : fetchFailed ? (
          <div className="rounded-xl border border-dashed border-border bg-surface/50 px-6 py-16 text-center">
            <p className="text-sm text-foreground">Couldn&apos;t reach the server</p>
            <p className="mt-1 text-xs text-muted">
              Make sure the API is running at localhost:8000, then refresh.
            </p>
          </div>
        ) : (
          <>
            {/* False friends */}
            <section className="mb-12">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    False friends
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    Words that look familiar but mean something else — pulled
                    from languages you already speak.
                  </p>
                </div>
              </div>

              {pairs.length === 0 ? (
                <EmptyState
                  message="No false friends encountered yet."
                  description="They'll appear here as you practice."
                  actionLabel="Start practicing"
                  actionHref="/"
                />
              ) : (
                <div className="-mx-6 flex gap-4 overflow-x-auto px-6 pb-2">
                  {pairs.map((deck) => {
                    const style = pairDeckStyle(
                      deck.native_lang,
                      deck.target_lang,
                    );
                    const state = exportStates.false_friends;
                    const deckKey = `${deck.native_lang}-${deck.target_lang}`;

                    return (
                      <DeckTile
                        key={deckKey}
                        subtitle={deck.subtitle.toUpperCase()}
                        label={deck.label}
                        count={deck.count}
                        gradientClass={style.gradientClass}
                        subtitleClass={style.subtitleClass}
                        onClick={() => openFalseFriendsDeck(deck)}
                        exportButton={
                          ankiStatus.connected ? (
                            <ExportButton
                              loading={state?.loading ?? false}
                              success={state?.success ?? null}
                              error={state?.error ?? null}
                              onClick={() =>
                                handleExportToAnki("false_friends", deck.label)
                              }
                            />
                          ) : null
                        }
                      />
                    );
                  })}
                </div>
              )}
            </section>

            {/* From your conversations */}
            <section>
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-foreground">
                  From your conversations
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Auto-built from your practices.
                </p>
              </div>

              <div className="-mx-6 flex gap-4 overflow-x-auto px-6 pb-2">
                <DeckTile
                  subtitle="Last 7 days"
                  label="Recent slip-ups"
                  count={recentDeck.length}
                  gradientClass="hover:shadow-indigo-500/15 bg-gradient-to-br from-indigo-900/35 via-accent/15 to-surface"
                  subtitleClass="text-accent-violet"
                  onClick={openRecentDeck}
                  disabled={recentDeck.length === 0}
                  exportButton={
                    ankiStatus.connected ? (
                      <ExportButton
                        loading={exportStates.mistakes?.loading ?? false}
                        success={exportStates.mistakes?.success ?? null}
                        error={exportStates.mistakes?.error ?? null}
                        onClick={() => handleExportToAnki("mistakes")}
                      />
                    ) : null
                  }
                />
                <DeckTile
                  subtitle="MY VOCABULARY"
                  label="Words I looked up"
                  count={vocabLookups.length}
                  gradientClass="hover:shadow-emerald-500/15 bg-gradient-to-br from-emerald-900/35 via-teal-900/15 to-surface"
                  subtitleClass="text-emerald-400"
                  onClick={openVocabDeck}
                  disabled={vocabLookups.length === 0}
                  emptyMessage="No words saved yet. Ask about any word during conversation — It will be added here automatically."
                  exportButton={
                    ankiStatus.connected ? (
                      <ExportButton
                        loading={exportStates.vocab?.loading ?? false}
                        success={exportStates.vocab?.success ?? null}
                        error={exportStates.vocab?.error ?? null}
                        onClick={() => handleExportToAnki("vocab")}
                      />
                    ) : null
                  }
                />
              </div>
            </section>
          </>
        )}
      </div>

      {/* Connect Anki Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 max-w-md rounded-xl bg-surface border border-border-subtle p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-foreground">
              Connect Anki
            </h3>
            <p className="mt-2 text-sm text-muted">
              Make sure Anki is open on your computer with the AnkiConnect plugin
              installed. Then refresh this page.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConnectModal(false)}
                className="rounded-lg border border-border-subtle bg-surface px-4 py-2 text-sm text-foreground hover:bg-surface-hover"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConnectModal(false);
                  window.location.reload();
                }}
                className="rounded-lg bg-accent px-4 py-2 text-sm text-foreground hover:bg-accent/90"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export All Modal */}
      {showExportAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 max-w-md rounded-xl bg-surface border border-border-subtle p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-foreground">
              Export all to Anki
            </h3>
            <p className="mt-2 text-sm text-muted">
              Export all flashcard decks to Anki? This will create PolyBridge decks
              in your Anki collection.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowExportAllModal(false)}
                className="rounded-lg border border-border-subtle bg-surface px-4 py-2 text-sm text-foreground hover:bg-surface-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExportAll}
                className="rounded-lg bg-accent px-4 py-2 text-sm text-foreground hover:bg-accent/90"
              >
                Export all
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
