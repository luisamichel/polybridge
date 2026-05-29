type FlashcardProps = {
  word: string;
  language: string;
  falseFriend: string;
  meaning: string;
  example: string;
};

export function Flashcard({
  word,
  language,
  falseFriend,
  meaning,
  example,
}: FlashcardProps) {
  return (
    <div className="flashcard-scene h-52 cursor-pointer sm:h-56">
      <div className="flashcard-inner h-full">
        <div className="flashcard-face flex flex-col items-center justify-center rounded-xl border border-border bg-surface p-6 text-center shadow-lg shadow-black/20">
          <span className="mb-2 text-xs font-medium uppercase tracking-wider text-accent">
            {language}
          </span>
          <h3 className="text-2xl font-semibold text-foreground">{word}</h3>
          <p className="mt-3 text-xs text-zinc-500">Hover to reveal</p>
        </div>

        <div className="flashcard-face flashcard-back flex flex-col items-center justify-center rounded-xl border border-accent/30 bg-accent/10 p-6 text-center shadow-lg shadow-accent/5">
          <span className="mb-1 text-xs font-medium uppercase tracking-wider text-red-400">
            False friend
          </span>
          <p className="text-lg font-medium text-foreground">{falseFriend}</p>
          <p className="mt-2 text-sm text-zinc-300">{meaning}</p>
          <p className="mt-3 text-xs italic text-zinc-500">&ldquo;{example}&rdquo;</p>
        </div>
      </div>
    </div>
  );
}
