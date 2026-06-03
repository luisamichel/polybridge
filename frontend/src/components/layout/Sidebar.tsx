"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  GitCompareArrows,
  MessageSquare,
  TrendingUp,
} from "lucide-react";
import { switchDatabase, getCurrentDatabase } from "@/lib/api";

const navItems = [
  { href: "/", label: "Chat", icon: MessageSquare },
  { href: "/error-notebook", label: "Errors Notebook", icon: BookOpen },
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
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleDemoSwitch = async () => {
    setIsSwitching(true);
    try {
      await switchDatabase("demo_luisa.db");
      setIsDemoModalOpen(false);
      // Reload the page to reflect the new database
      window.location.reload();
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Failed to switch to demo database");
    } finally {
      setIsSwitching(false);
    }
  };

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

      {/* Demo button at bottom */}
      <div className="border-t border-border-subtle p-3">
        <button
          onClick={() => setIsDemoModalOpen(true)}
          className="w-full rounded-lg px-3 py-2 text-xs text-muted transition-all duration-200 hover:bg-surface-hover hover:text-foreground"
        >
          Demo
        </button>
      </div>

      {/* Demo confirmation modal */}
      {mounted && isDemoModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-[#d4cbb8] bg-[#fdfaf5] p-6 shadow-xl">
            <h2 className="mb-2 text-xl font-semibold text-[#2a2218]">
              Switch to Demo?
            </h2>
            <p className="mb-6 text-sm leading-relaxed text-[#5c5346]">
              This will switch to the demo database with pre-loaded content.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsDemoModalOpen(false)}
                disabled={isSwitching}
                className="rounded-md px-4 py-2 text-sm font-medium text-[#5c5346] transition-colors hover:bg-[#ddd4c0]"
              >
                Cancel
              </button>
              <button
                onClick={handleDemoSwitch}
                disabled={isSwitching}
                className="rounded-md bg-accent/90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent disabled:opacity-50"
              >
                {isSwitching ? "Switching..." : "Switch to Demo"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </aside>
  );
}
