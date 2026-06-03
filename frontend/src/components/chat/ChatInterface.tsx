"use client";

import {
  Dispatch,
  FormEvent,
  Fragment,
  SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";
import { ArrowUp, Loader2, Sparkles } from "lucide-react";
import { useChatModel, type ChatUiMessage } from "@/components/chat/ChatProvider";
import {
  getSuggestedPrompts,
  isWelcomeOnlyState,
} from "@/components/chat/welcome";
import { chatMarkdownComponents } from "@/components/chat/chatMarkdown";
import { sendMessage, type Message as ApiMessage } from "@/lib/api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const THINKING_STATUS = "Thinking...";

type ChatInterfaceProps = {
  messages: ChatUiMessage[];
  setMessages: Dispatch<SetStateAction<ChatUiMessage[]>>;
};

export function ChatInterface({ messages, setMessages }: ChatInterfaceProps) {
  const {
    selectedModelId,
    modelsLoading,
    modelsError,
    hasProfile,
    targetLanguage,
  } = useChatModel();
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [toolActivity, setToolActivity] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, toolActivity, isStreaming]);

  async function sendUserMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isStreaming || modelsLoading || !selectedModelId) return;

    const userMessage: ChatUiMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };

    const assistantId = crypto.randomUUID();
    const assistantPlaceholder: ChatUiMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
    };

    const nextMessages = [...messages, userMessage, assistantPlaceholder];
    setMessages(nextMessages);
    setToolActivity(null);
    setIsStreaming(true);

    const apiMessages: ApiMessage[] = nextMessages.map(({ role, content }) => ({
      role,
      content,
    }));

    const clearAssistantContent = () => {
      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId ? { ...message, content: "" } : message,
        ),
      );
    };

    await sendMessage(apiMessages, selectedModelId, {
      onChunk: (chunk) => {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId
              ? { ...message, content: message.content + chunk }
              : message,
          ),
        );
      },
      onTextReset: clearAssistantContent,
      onToolStart: (display, _tool) => {
        clearAssistantContent();
        setToolActivity(display);
      },
      onToolEnd: () => {
        setTimeout(() => setToolActivity(null), 2000);
      },
      onDone: () => {
        setToolActivity(null);
        setIsStreaming(false);

        window.dispatchEvent(new Event("profileUpdated"));
      },
      onError: (message) => {
        setToolActivity(null);
        setIsStreaming(false);
        setMessages((prev) => {
          const withoutPlaceholder = prev.filter(
            (message) => message.id !== assistantId,
          );
          return [
            ...withoutPlaceholder,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: message,
              isError: true,
            },
          ];
        });
      },
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    await sendUserMessage(trimmed);
    setInput("");
  }

  const canSend =
    Boolean(input.trim()) &&
    !isStreaming &&
    !modelsLoading &&
    Boolean(selectedModelId);

  const showSuggestedPrompts = isWelcomeOnlyState(messages);
  const suggestedPrompts = getSuggestedPrompts(hasProfile, targetLanguage);

  function handleSuggestedPrompt(prompt: string) {
    void sendUserMessage(prompt);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="chat-scroll flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          {modelsError && (
            <div
              role="alert"
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
            >
              {modelsError}
            </div>
          )}
          {messages.map((message, index) => {
            const isLast = index === messages.length - 1;
            const isStreamingAssistant =
              message.role === "assistant" &&
              !message.isError &&
              isStreaming &&
              isLast;
            const previousMessage = index > 0 ? messages[index - 1] : null;
            const showStreamingStatusArea =
              isStreamingAssistant && previousMessage?.role === "user";
            const showStreamingStatus =
              showStreamingStatusArea &&
              (Boolean(toolActivity) || !message.content);
            const streamingStatusText = toolActivity ? toolActivity : THINKING_STATUS;
            const showMessageBubble =
              message.role === "user" ||
              Boolean(message.content) ||
              message.isError;

            return (
              <Fragment key={message.id}>
                {showStreamingStatusArea ? (
                  <p
                    className={`min-h-5 pl-11 text-sm leading-5 text-accent-cyan/90 transition-opacity duration-300 ease-in-out ${
                      showStreamingStatus ? "opacity-100" : "opacity-0"
                    }`}
                    aria-live="polite"
                  >
                    <span key={streamingStatusText} className="chat-status-fade-in">
                      <span className="animate-pulse">{streamingStatusText}</span>
                    </span>
                  </p>
                ) : null}
                {showMessageBubble && (
                  <div
                    className={`flex gap-3 ${
                      message.role === "user" ? "flex-row-reverse" : ""
                    }`}
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        message.isError
                          ? "bg-red-500/15 ring-1 ring-red-500/25"
                          : message.role === "assistant"
                            ? "bg-accent/15 ring-1 ring-accent/25"
                            : "bg-surface ring-1 ring-border"
                      }`}
                    >
                      {message.role === "assistant" ? (
                        <Sparkles
                          className={`h-4 w-4 ${message.isError ? "text-red-400" : "text-accent"}`}
                        />
                      ) : (
                        <span className="text-xs font-medium text-zinc-400">
                          You
                        </span>
                      )}
                    </div>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        message.isError
                          ? "bg-red-500/10 text-red-300 ring-1 ring-red-500/30"
                          : message.role === "user"
                            ? "bg-accent/15 text-foreground ring-1 ring-accent/20"
                            : "bg-surface text-zinc-300 ring-1 ring-border-subtle"
                      }`}
                    >
                      {/* Wrap the markdown component in a div to apply the flex layout */}
                      <div className="flex flex-col gap-2">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={chatMarkdownComponents}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                )}
              </Fragment>
            );
          })}
          {showSuggestedPrompts ? (
            <div className="flex flex-wrap gap-1.5 pl-11">
              {suggestedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handleSuggestedPrompt(prompt)}
                  disabled={isStreaming || modelsLoading || !selectedModelId}
                  className="rounded-full border border-accent/40 bg-accent/15 px-2.5 py-1 text-xs font-medium text-foreground/90 shadow-sm shadow-accent/10 ring-1 ring-accent/20 transition-colors hover:border-accent/55 hover:bg-accent/25 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          ) : null}
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
                    : isStreaming
                      ? "Waiting for response…"
                      : "Message PolyBridge..."
              }
              rows={1}
              disabled={isStreaming || modelsLoading || !selectedModelId}
              className="max-h-32 min-h-[48px] w-full resize-none rounded-xl border border-border bg-surface px-4 py-3 pr-12 text-sm text-foreground placeholder:text-zinc-600 focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
          <button
            type="submit"
            disabled={!canSend}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-white transition-colors hover:bg-accent-muted disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Send message"
          >
            {isStreaming ? (
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
