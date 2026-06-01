"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { getModels, type ChatModel } from "@/lib/api";

export type ChatUiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  isError?: boolean;
};

const welcomeMessage: ChatUiMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Welcome to PolyBridge! I'm here to help you practice languages through conversation. What would you like to work on today?",
};

const initialMessages: ChatUiMessage[] = [welcomeMessage];

type ChatContextValue = {
  models: ChatModel[];
  selectedModelId: string;
  setSelectedModelId: (id: string) => void;
  modelsLoading: boolean;
  modelsError: string | null;
  messages: ChatUiMessage[];
  setMessages: Dispatch<SetStateAction<ChatUiMessage[]>>;
};

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [models, setModels] = useState<ChatModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatUiMessage[]>(initialMessages);

  const loadModels = useCallback(async () => {
    setModelsLoading(true);
    setModelsError(null);
    try {
      const list = await getModels();
      setModels(list);
      setSelectedModelId((current) => {
        if (current && list.some((m) => m.id === current)) {
          return current;
        }
        return list[0]?.id ?? "";
      });
    } catch (err) {
      setModels([]);
      setModelsError(
        err instanceof Error ? err.message : "Could not load models.",
      );
    } finally {
      setModelsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadModels();
  }, [loadModels]);

  const value = useMemo(
    () => ({
      models,
      selectedModelId,
      setSelectedModelId,
      modelsLoading,
      modelsError,
      messages,
      setMessages,
    }),
    [models, selectedModelId, modelsLoading, modelsError, messages],
  );

  return (
    <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
  );
}

export function useChatModel() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChatModel must be used within ChatProvider");
  }
  return context;
}

export function useChatMessages() {
  const { messages, setMessages } = useChatModel();
  return { messages, setMessages };
}
