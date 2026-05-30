type DeckTileProps = {
  subtitle: string;
  label: string;
  count: number;
  gradientClass: string;
  subtitleClass: string;
  onClick: () => void;
  disabled?: boolean;
};

export function DeckTile({
  subtitle,
  label,
  count,
  gradientClass,
  subtitleClass,
  onClick,
  disabled = false,
}: DeckTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || count === 0}
      className={`group relative flex h-44 w-64 shrink-0 flex-col justify-between overflow-hidden rounded-2xl border border-border-subtle p-5 text-left transition-all duration-200 ${gradientClass} ${
        disabled || count === 0
          ? "cursor-not-allowed opacity-50"
          : "cursor-pointer hover:scale-[1.02] hover:border-accent/40 hover:shadow-lg"
      }`}
    >
      <div className="relative">
        <p
          className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${subtitleClass}`}
        >
          {subtitle}
        </p>
        <h3 className="mt-3 text-xl font-semibold leading-tight text-foreground">
          {label}
        </h3>
      </div>
      <p className="relative text-sm text-muted">
        {count} {count === 1 ? "card" : "cards"}
      </p>
    </button>
  );
}
