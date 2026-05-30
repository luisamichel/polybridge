"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  GitCompareArrows,
  MessageSquare,
  TrendingUp,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Chat", icon: MessageSquare },
  { href: "/error-notebook", label: "Error Notebook", icon: BookOpen },
  { href: "/progress", label: "Progress", icon: TrendingUp },
  {
    href: "/false-friends",
    label: "Flashcards",
    icon: GitCompareArrows,
  },
];

function PolyBridgeLogo() {
  return (
    <Image
      src="/logo.png"
      alt="PolyBridge — Language learning"
      width={660}
      height={289}
      className="h-auto w-full"
      priority
    />
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="relative flex h-full w-60 shrink-0 flex-col border-r border-border-subtle bg-sidebar">
      {/* Subtle vertical accent line */}
      <div className="absolute right-0 top-0 h-full w-px bg-gradient-to-b from-accent/50 via-accent-teal/30 to-transparent" />

      <div className="border-b border-border-subtle px-2.5 py-4">
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
