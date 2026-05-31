"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getModels, type ChatModel } from "@/lib/api";

type ChatContextValue = {
  models: ChatModel[];
  selectedModelId: string;
  setSelectedModelId: (id: string) => void;
  modelsLoading: boolean;
  modelsError: string | null;
};

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [models, setModels] = useState<ChatModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);

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
    }),
    [models, selectedModelId, modelsLoading, modelsError],
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
