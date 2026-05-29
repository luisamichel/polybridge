import { TrendingUp } from "lucide-react";

const stats = [
  { label: "Sessions", value: "—" },
  { label: "Words learned", value: "—" },
  { label: "Streak", value: "—" },
];

export default function ProgressPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6">
      <div className="flex max-w-lg flex-col items-center text-center">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface ring-1 ring-border">
          <TrendingUp className="h-7 w-7 text-zinc-500" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Progress
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">
          Track your learning journey over time. Detailed analytics and charts
          will be available here soon.
        </p>

        <div className="mt-8 grid w-full grid-cols-3 gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-border-subtle bg-surface px-4 py-5"
            >
              <p className="text-2xl font-semibold text-foreground">
                {stat.value}
              </p>
              <p className="mt-1 text-xs text-zinc-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
