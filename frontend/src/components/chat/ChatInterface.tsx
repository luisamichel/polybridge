"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, Sparkles } from "lucide-react";
import { useChatModel } from "@/components/chat/ChatProvider";
import { sendMessage, type Message as ApiMessage } from "@/lib/api";

type UiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const welcomeMessage: UiMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Welcome to PolyBridge! I'm here to help you practice languages through conversation. What would you like to work on today?",
};

export function ChatInterface() {
  const { selectedModelId, modelsLoading, modelsError } = useChatModel();
  const [messages, setMessages] = useState<UiMessage[]>([welcomeMessage]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading || modelsLoading || !selectedModelId) return;

    const userMessage: UiMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setError(null);
    setIsLoading(true);

    const apiMessages: ApiMessage[] = nextMessages.map(({ role, content }) => ({
      role,
      content,
    }));

    try {
      const { response } = await sendMessage(apiMessages, selectedModelId);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response,
        },
      ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not get a response. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  const canSend =
    Boolean(input.trim()) &&
    !isLoading &&
    !modelsLoading &&
    Boolean(selectedModelId);

  return (
    <div className="flex h-full flex-col">
      <div className="chat-scroll flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          {(modelsError || error) && (
            <div
              role="alert"
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
            >
              {error ?? modelsError}
            </div>
          )}
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
          {isLoading && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 ring-1 ring-accent/25">
                <Sparkles className="h-4 w-4 text-accent" />
              </div>
              <div className="flex items-center gap-2 rounded-2xl bg-surface px-4 py-3 text-sm text-zinc-400 ring-1 ring-border-subtle">
                <Loader2 className="h-4 w-4 animate-spin text-accent" />
                <span>PolyBridge is thinking…</span>
              </div>
            </div>
          )}
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
              placeholder={
                modelsLoading
                  ? "Loading models…"
                  : !selectedModelId
                    ? "Select a model to start chatting…"
                    : "Message PolyBridge..."
              }
              rows={1}
              disabled={isLoading || modelsLoading || !selectedModelId}
              className="max-h-32 min-h-[48px] w-full resize-none rounded-xl border border-border bg-surface px-4 py-3 pr-12 text-sm text-foreground placeholder:text-zinc-600 focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
          <button
            type="submit"
            disabled={!canSend}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-white transition-colors hover:bg-accent-muted disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Send message"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <ArrowUp className="h-5 w-5" />
            )}
          </button>
        </form>
        <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-zinc-600">
          PolyBridge can make mistakes. Verify important language details.
        </p>
      </div>
    </div>
  );
}
