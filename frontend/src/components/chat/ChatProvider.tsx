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
import { getModels, getProfile, type ChatModel } from "@/lib/api";
import { isProfileConfigured } from "@/lib/profile";
import {
  buildWelcomeMessage,
  isWelcomeOnlyState,
} from "@/components/chat/welcome";

export type ChatUiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  isError?: boolean;
};

type ChatContextValue = {
  models: ChatModel[];
  selectedModelId: string;
  setSelectedModelId: (id: string) => void;
  modelsLoading: boolean;
  modelsError: string | null;
  messages: ChatUiMessage[];
  setMessages: Dispatch<SetStateAction<ChatUiMessage[]>>;
  hasProfile: boolean;
  targetLanguage: string | null;
};

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [models, setModels] = useState<ChatModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatUiMessage[]>([]);
  const [hasProfile, setHasProfile] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState<string | null>(null);

  const syncProfile = useCallback(async () => {
    const profile = await getProfile();
    const configured = isProfileConfigured(profile);
    setHasProfile(configured);
    setTargetLanguage(
      configured ? profile?.target_language?.trim() ?? null : null,
    );
    return configured;
  }, []);

  const resetToWelcome = useCallback(async () => {
    const configured = await syncProfile();
    setMessages([buildWelcomeMessage(configured)]);
  }, [syncProfile]);

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

  useEffect(() => {
    void resetToWelcome();
  }, [resetToWelcome]);

  useEffect(() => {
    const handleChatReset = () => {
      void resetToWelcome();
    };
    window.addEventListener("chatReset", handleChatReset);
    return () => window.removeEventListener("chatReset", handleChatReset);
  }, [resetToWelcome]);

  useEffect(() => {
    const handleProfileUpdated = () => {
      void syncProfile().then((configured) => {
        setMessages((current) => {
          if (!isWelcomeOnlyState(current)) return current;
          return [buildWelcomeMessage(configured)];
        });
      });
    };
    window.addEventListener("profileUpdated", handleProfileUpdated);
    return () =>
      window.removeEventListener("profileUpdated", handleProfileUpdated);
  }, [syncProfile]);

  const value = useMemo(
    () => ({
      models,
      selectedModelId,
      setSelectedModelId,
      modelsLoading,
      modelsError,
      messages,
      setMessages,
      hasProfile,
      targetLanguage,
    }),
    [
      models,
      selectedModelId,
      modelsLoading,
      modelsError,
      messages,
      hasProfile,
      targetLanguage,
    ],
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
