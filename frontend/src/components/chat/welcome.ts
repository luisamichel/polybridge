import type { ChatUiMessage } from "@/components/chat/ChatProvider";

export function buildWelcomeMessage(hasProfile: boolean): ChatUiMessage {
  return {
    id: "welcome",
    role: "assistant",
    content: hasProfile
      ? "Welcome back! Ready to jump into conversation?"
      : "Welcome to PolyBridge! I'm here to help you practice languages through conversation, building on linguistic knowledge you already have. Ready to learn?",
  };
}

export function getSuggestedPrompts(
  hasProfile: boolean,
  targetLanguage: string | null,
): string[] {
  if (!hasProfile) {
    return ["Set up my learner profile!"];
  }

  const language = targetLanguage?.trim() || "your target language";

  return [
    `Let's practice ${language}`,
    "What are my biggest mistakes?",
    "What should I focus on today?",
    "Show me my progress",
  ];
}

export function isWelcomeOnlyState(messages: ChatUiMessage[]): boolean {
  return (
    messages.length === 1 &&
    messages[0]?.id === "welcome" &&
    messages[0].role === "assistant" &&
    !messages[0].isError
  );
}
