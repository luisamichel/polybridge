"use client";

import { useState } from "react";
import { ArrowLeft, Check, Lightbulb, X } from "lucide-react";

export type StudyCard = {
  id: string;
  front: string;
  back: string;
  hint?: string;
  note?: string;
};

type StudySessionProps = {
  deckTitle: string;
  sectionLabel: string;
  cards: StudyCard[];
  onExit: () => void;
};

export function StudySession({
  deckTitle,
  sectionLabel,
  cards,
  onExit,
}: StudySessionProps) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [againCount, setAgainCount] = useState(0);
  const [goodCount, setGoodCount] = useState(0);

  const card = cards[index];
  const isLast = index >= cards.length - 1;

  function advance() {
    setFlipped(false);
    if (isLast) {
      onExit();
      return;
    }
    setIndex((current) => current + 1);
  }

  function handleAgain() {
    setAgainCount((count) => count + 1);
    advance();
  }

  function handleGood() {
    setGoodCount((count) => count + 1);
    advance();
  }

  if (!card) {
    return null;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border-subtle px-6 py-4">
        <button
          type="button"
          onClick={onExit}
          className="flex items-center gap-2 text-sm text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          All decks
        </button>
        <p className="text-sm text-muted">
          {sectionLabel} · {deckTitle}
        </p>
      </div>

      <div className="flex items-center justify-between px-6 py-3 text-sm">
        <span className="text-muted">
          {index + 1} / {cards.length}
        </span>
        <div className="flex items-center gap-4">
          <span className="text-red-400">Again {againCount}</span>
          <span className="text-emerald-400">Good {goodCount}</span>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-8">
        <div
          className={`flashcard-scene flashcard-clickable w-full max-w-2xl ${flipped ? "flashcard-flipped" : ""}`}
          style={{ height: "320px" }}
        >
          <button
            type="button"
            onClick={() => setFlipped((value) => !value)}
            className="flashcard-inner h-full w-full cursor-pointer text-left"
            aria-label={flipped ? "Show front of card" : "Show back of card"}
          >
            <div className="flashcard-face flex flex-col rounded-2xl border border-border bg-surface p-8 shadow-xl shadow-black/30">
              <p className="text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                Front
              </p>
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <p className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                  {card.front}
                </p>
                {card.hint ? (
                  <div className="mt-6 flex items-center gap-2 rounded-full bg-surface-hover px-4 py-2 text-sm text-muted ring-1 ring-border-subtle">
                    <Lightbulb className="h-4 w-4 shrink-0 text-accent-cyan" />
                    <span>{card.hint}</span>
                  </div>
                ) : null}
              </div>
              <p className="text-right text-xs text-muted">Tap to flip</p>
            </div>

            <div className="flashcard-face flashcard-back flex flex-col rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/10 via-surface to-accent-teal/5 p-8 shadow-xl shadow-accent/5">
              <p className="text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-accent-violet">
                Back
              </p>
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <p className="text-3xl font-semibold text-foreground sm:text-4xl">
                  {card.back}
                </p>
                {card.note ? (
                  <p className="mt-6 max-w-md text-sm leading-relaxed text-zinc-300">
                    {card.note}
                  </p>
                ) : null}
              </div>
              <p className="text-right text-xs text-muted">Tap to flip</p>
            </div>
          </button>
        </div>

        <div className="mt-8 grid w-full max-w-2xl grid-cols-2 gap-4">
          <button
            type="button"
            onClick={handleAgain}
            className="flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 py-4 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/20"
          >
            <X className="h-4 w-4" />
            Again
          </button>
          <button
            type="button"
            onClick={handleGood}
            className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-4 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20"
          >
            <Check className="h-4 w-4" />
            Good
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          Ratings will sync to Anki when connected (SM-2 scheduling).
        </p>
      </div>
    </div>
  );
}
