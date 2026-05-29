"use client";

import { FormEvent, useRef, useState } from "react";
import { ArrowUp, Sparkles } from "lucide-react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const initialMessages: Message[] = [
  {
    id: "1",
    role: "assistant",
    content:
      "Welcome to PolyBridge! I'm here to help you practice languages through conversation. What would you like to work on today?",
  },
  {
    id: "2",
    role: "user",
    content:
      "Can you help me practice Spanish subjunctive mood in everyday sentences?",
  },
  {
    id: "3",
    role: "assistant",
    content:
      "Absolutely. Let's start with a common pattern: expressing wishes. Try completing this sentence:\n\n\"Espero que tú ___ (venir) a la fiesta mañana.\"\n\nWhat verb form would you use, and why?",
  },
];

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="chat-scroll flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${
                message.role === "user" ? "flex-row-reverse" : ""
              }`}
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  message.role === "assistant"
                    ? "bg-accent/15 ring-1 ring-accent/25"
                    : "bg-surface ring-1 ring-border"
                }`}
              >
                {message.role === "assistant" ? (
                  <Sparkles className="h-4 w-4 text-accent" />
                ) : (
                  <span className="text-xs font-medium text-zinc-400">You</span>
                )}
              </div>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  message.role === "user"
                    ? "bg-accent/15 text-foreground ring-1 ring-accent/20"
                    : "bg-surface text-zinc-300 ring-1 ring-border-subtle"
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="shrink-0 border-t border-border-subtle bg-background px-4 py-4">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex max-w-3xl items-end gap-3"
        >
          <div className="relative flex-1">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="Message PolyBridge..."
              rows={1}
              className="max-h-32 min-h-[48px] w-full resize-none rounded-xl border border-border bg-surface px-4 py-3 pr-12 text-sm text-foreground placeholder:text-zinc-600 focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30"
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim()}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-white transition-colors hover:bg-accent-muted disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Send message"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        </form>
        <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-zinc-600">
          PolyBridge can make mistakes. Verify important language details.
        </p>
      </div>
    </div>
  );
}
