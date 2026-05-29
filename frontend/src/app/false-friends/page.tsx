import { Flashcard } from "@/components/false-friends/Flashcard";
import { GitCompareArrows } from "lucide-react";

const cards = [
  {
    word: "embarazada",
    language: "Spanish",
    falseFriend: "embarrassed",
    meaning: "Actually means pregnant, not embarrassed",
    example: "Estoy embarazada — I am pregnant (not embarrassed!)",
  },
  {
    word: "actual",
    language: "Spanish / German",
    falseFriend: "actual",
    meaning: "Means current or present, not actual/real",
    example: "La situación actual — The current situation",
  },
  {
    word: "gift",
    language: "German",
    falseFriend: "gift",
    meaning: "Means poison in German, not a present",
    example: "Das Gift ist gefährlich — The poison is dangerous",
  },
];

export default function FalseFriendsPage() {
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl px-6 py-8">
        <div className="mb-8 flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/15 ring-1 ring-accent/25">
            <GitCompareArrows className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              False Friends (Anki)
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Words that look familiar but mean something different. Hover each
              card to reveal the translation.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <Flashcard key={card.word} {...card} />
          ))}
        </div>
      </div>
    </div>
  );
}
