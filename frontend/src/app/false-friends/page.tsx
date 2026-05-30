"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Download,
  Link2,
  Loader2,
  Upload,
} from "lucide-react";
import { DeckTile } from "@/components/flashcards/DeckTile";
import {
  StudySession,
  type StudyCard,
} from "@/components/flashcards/StudySession";
import {
  getFalseFriendsByPair,
  getRecentDeck,
  type FalseFriendCard,
  type FalseFriendsByPair,
  type RecentDeckCard,
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

export default function FlashcardsPage() {
  const [pairs, setPairs] = useState<FalseFriendsByPair[]>([]);
  const [recentDeck, setRecentDeck] = useState<RecentDeckCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [activeDeck, setActiveDeck] = useState<ActiveDeck | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setFetchFailed(false);

      const [pairsData, recentData] = await Promise.all([
        getFalseFriendsByPair(),
        getRecentDeck(),
      ]);

      if (cancelled) return;

      if (pairsData === null && recentData === null) {
        setFetchFailed(true);
      }

      setPairs(pairsData ?? []);
      setRecentDeck(recentData ?? []);
      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const recentCards = useMemo(
    () => recentDeck.map(recentToStudyCard),
    [recentDeck],
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
      sectionLabel: "From your mistakes",
      deckTitle: "Recent slip-ups",
      cards: recentCards,
    });
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
        <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Flashcards
            </h1>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">
              Pick a deck to practice. Decks sync with your Anki collection.
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 sm:items-end">
            <div className="flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-xs text-muted ring-1 ring-border-subtle">
              <span className="h-2 w-2 rounded-full bg-zinc-600" />
              Anki: not connected
            </div>
            <div className="flex flex-wrap gap-2">
              <ComingSoonButton icon={Link2}>Connect Anki</ComingSoonButton>
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
                <div className="rounded-xl border border-dashed border-border bg-surface/50 px-6 py-10 text-center">
                  <p className="text-sm text-muted">
                    No false friend decks for your profile yet.
                  </p>
                </div>
              ) : (
                <div className="-mx-6 flex gap-4 overflow-x-auto px-6 pb-2">
                  {pairs.map((deck) => {
                    const style = pairDeckStyle(
                      deck.native_lang,
                      deck.target_lang,
                    );

                    return (
                      <DeckTile
                        key={`${deck.native_lang}-${deck.target_lang}`}
                        subtitle={deck.subtitle.toUpperCase()}
                        label={deck.label}
                        count={deck.count}
                        gradientClass={style.gradientClass}
                        subtitleClass={style.subtitleClass}
                        onClick={() => openFalseFriendsDeck(deck)}
                      />
                    );
                  })}
                </div>
              )}
            </section>

            {/* From your mistakes */}
            <section>
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-foreground">
                  From your mistakes
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Auto-built from your errors notebook.
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
                />
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
