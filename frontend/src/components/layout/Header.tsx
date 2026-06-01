"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bot, Check, ChevronDown, Loader2, Sparkles } from "lucide-react";
import { useChatModel } from "@/components/chat/ChatProvider";
import NewLearnerButton from "./NewLearnerButton";
import ProfileBadge from "./ProfileBadge";

export function Header() {
  const pathname = usePathname();
  const isChatPage = pathname === "/";

  const {
    models,
    selectedModelId,
    setSelectedModelId,
    modelsLoading,
    modelsError,
  } = useChatModel();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeOption =
    models.find((model) => model.id === selectedModelId) ?? models[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!isChatPage) {
    return null;
  }

return (
    <header className="relative z-10 flex h-14 shrink-0 items-center justify-between border-b border-border-subtle/80 bg-background/50 px-5 backdrop-blur-md">
      {/* LEFT SIDE: LLM Dropdown */}
      <div ref={dropdownRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          disabled={modelsLoading || models.length === 0}
          className={`flex items-center gap-2.5 rounded-xl border bg-surface/80 px-3.5 py-2 text-sm transition-all duration-200 hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60 ${
            open
              ? "border-accent/50 glow-accent"
              : "border-border hover:border-accent/30"
          }`}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-brand">
            <Bot className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-muted">Active LLM</span>
          <span className="font-medium text-foreground">
            {modelsLoading ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading…
              </span>
            ) : modelsError ? (
              "Unavailable"
            ) : (
              (activeOption?.name ?? "Select model")
            )}
          </span>
          <ChevronDown
            className={`h-4 w-4 text-accent-violet transition-transform duration-200 ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>

        {open && (
          <ul
            role="listbox"
            className="absolute left-0 z-50 mt-2 max-h-72 w-72 overflow-y-auto rounded-xl border border-border bg-surface py-1 shadow-2xl shadow-black/50 glow-accent"
          >
            <li className="border-b border-border-subtle px-3.5 py-2">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
                <Sparkles className="h-3 w-3 text-accent" />
                Select model
              </div>
            </li>
            {modelsError && (
              <li className="px-3.5 py-2 text-xs text-red-400">{modelsError}</li>
            )}
            {!modelsError && models.length === 0 && !modelsLoading && (
              <li className="px-3.5 py-2 text-xs text-muted">
                No models available.
              </li>
            )}
            {models.map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selectedModelId === option.id}
                  onClick={() => {
                    setSelectedModelId(option.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between px-3.5 py-2.5 text-left text-sm transition-colors ${
                    selectedModelId === option.id
                      ? "bg-gradient-to-r from-accent/15 to-accent-teal/10"
                      : "hover:bg-surface-hover"
                  }`}
                >
                  <span
                    className={
                      selectedModelId === option.id
                        ? "font-medium text-foreground"
                        : "text-muted"
                    }
                  >
                    {option.name}
                  </span>
                  {selectedModelId === option.id ? (
                    <Check className="h-4 w-4 shrink-0 text-accent-cyan" />
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* RIGHT SIDE: Profile and New Learner Button */}
      <div className="flex items-center gap-4">
        <ProfileBadge />
        <div className="h-4 w-px bg-border-subtle/80"></div> {/* Optional divider line */}
        <NewLearnerButton />
      </div>
    </header>
  );
}
