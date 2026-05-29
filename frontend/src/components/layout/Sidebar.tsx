"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  GitCompareArrows,
  MessageSquare,
  Orbit,
  TrendingUp,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Chat", icon: MessageSquare },
  { href: "/error-notebook", label: "Error Notebook", icon: BookOpen },
  { href: "/progress", label: "Progress", icon: TrendingUp },
  {
    href: "/false-friends",
    label: "False Friends (Anki)",
    icon: GitCompareArrows,
  },
];

function PolyBridgeLogo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative shrink-0">
        <div className="absolute -inset-1 rounded-xl bg-gradient-to-br from-accent/40 to-accent-teal/40 opacity-60 blur-md" />
        <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent/20 to-accent-teal/20 ring-1 ring-accent/40">
          <Orbit className="h-5 w-5 text-accent-cyan" strokeWidth={1.75} />
        </div>
      </div>
      <div>
        <h1 className="text-[1.15rem] font-extrabold leading-none tracking-tight">
          <span className="text-white">Poly</span>
          <span className="text-gradient-brand">Bridge</span>
        </h1>
        <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-accent-teal/70">
          Language learning
        </p>
      </div>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="relative flex h-full w-60 shrink-0 flex-col border-r border-border-subtle bg-sidebar">
      {/* Subtle vertical accent line */}
      <div className="absolute right-0 top-0 h-full w-px bg-gradient-to-b from-accent/50 via-accent-teal/30 to-transparent" />

      <div className="border-b border-border-subtle px-5 py-6">
        <PolyBridgeLogo />
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200 ${
                isActive
                  ? "bg-gradient-to-r from-accent/20 via-accent/10 to-accent-teal/10 text-foreground glow-accent"
                  : "text-muted hover:bg-surface-hover hover:text-foreground"
              }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 transition-colors ${
                  isActive
                    ? "text-accent-cyan"
                    : "text-muted group-hover:text-accent-violet"
                }`}
              />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border-subtle p-4">
        <p className="text-[11px] leading-relaxed text-muted/80">
          Bridge languages with{" "}
          <span className="text-gradient-brand font-medium">AI-powered</span>{" "}
          practice.
        </p>
      </div>
    </aside>
  );
}
