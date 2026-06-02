import Link from "next/link";

type EmptyStateProps = {
  message: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  className?: string;
};

export function EmptyState({
  message,
  description,
  actionLabel,
  actionHref,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`rounded-xl border border-border-subtle bg-surface/60 px-6 py-10 text-center ${className}`}
    >
      <p className="text-sm leading-relaxed text-foreground">{message}</p>
      {description ? (
        <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>
      ) : null}
      {actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="mt-4 inline-flex rounded-full bg-gradient-brand px-4 py-2 text-sm font-medium text-white shadow-md shadow-accent/20 transition-opacity hover:opacity-90"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
