"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Check, ChevronDown, Sparkles } from "lucide-react";

const llmOptions = [
  { id: "gemini", label: "Gemini 1.5 Pro", color: "text-blue-400" },
  { id: "claude", label: "Claude 3.5 Sonnet", color: "text-orange-400" },
  { id: "gpt4o", label: "GPT-4o", color: "text-emerald-400" },
] as const;

type LlmId = (typeof llmOptions)[number]["id"];

export function Header() {
  const [selected, setSelected] = useState<LlmId>("claude");
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeOption =
    llmOptions.find((opt) => opt.id === selected) ?? llmOptions[1];

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

  return (
    <header className="relative z-10 flex h-14 shrink-0 items-center border-b border-border-subtle/80 bg-background/50 px-5 backdrop-blur-md">
      <div ref={dropdownRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className={`flex items-center gap-2.5 rounded-xl border bg-surface/80 px-3.5 py-2 text-sm transition-all duration-200 hover:bg-surface-hover ${
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
            {activeOption.label}
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
            className="absolute left-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-2xl shadow-black/50 glow-accent"
          >
            <li className="border-b border-border-subtle px-3.5 py-2">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
                <Sparkles className="h-3 w-3 text-accent" />
                Select model
              </div>
            </li>
            {llmOptions.map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected === option.id}
                  onClick={() => {
                    setSelected(option.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between px-3.5 py-2.5 text-left text-sm transition-colors ${
                    selected === option.id
                      ? "bg-gradient-to-r from-accent/15 to-accent-teal/10"
                      : "hover:bg-surface-hover"
                  }`}
                >
                  <span
                    className={
                      selected === option.id
                        ? "font-medium text-foreground"
                        : "text-muted"
                    }
                  >
                    {option.label}
                  </span>
                  {selected === option.id ? (
                    <Check className="h-4 w-4 text-accent-cyan" />
                  ) : (
                    <span
                      className={`h-2 w-2 rounded-full bg-current opacity-40 ${option.color}`}
                    />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </header>
  );
}
