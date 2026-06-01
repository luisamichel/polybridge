const API_BASE = "http://localhost:8000";

export type ReportPeriod = "all_time" | "this_week" | "last_session";

export interface Profile {
  id?: number;
  target_language?: string;
  native_languages?: string;
  proficiency?: string;
}

export interface ErrorEntry {
  id: number;
  timestamp: string;
  mistake: string;
  correction: string;
  category: string | null;
  interference_lang: string | null;
  context: string | null;
  notes: string | null;
}

export interface CategoryCount {
  category: string;
  count: number;
}

export interface InterferenceLangCount {
  interference_lang: string;
  count: number;
}

export interface RepeatedMistake {
  mistake: string;
  correction: string;
  times: number;
}

export interface ErrorPatterns {
  by_category: CategoryCount[];
  by_interference_lang: InterferenceLangCount[];
  repeated_mistakes: RepeatedMistake[];
}

export interface FalseFriend {
  id: number;
  word: string;
  translation: string | null;
  target_language: string | null;
  cognate_in: string | null;
  is_false_friend: number;
  priority: string;
  first_seen: string | null;
}

export interface FalseFriendCard {
  native_lang: string;
  target_lang: string;
  native_word: string;
  target_word: string;
  target_actual_meaning: string;
  native_assumed_meaning: string;
  danger: string;
}

export interface FalseFriendsByPair {
  native_lang: string;
  target_lang: string;
  label: string;
  subtitle: string;
  count: number;
  cards: FalseFriendCard[];
}

export interface RecentDeckCard {
  front: string;
  back: string;
  note: string | null;
  category: string;
  interference_lang: string | null;
}

export interface Session {
  id: number;
  date: string;
  topic: string | null;
  summary: string | null;
  errors_made: number;
}

export interface Report {
  id?: number;
  generated_at?: string;
  period?: string;
  content?: string;
  shared?: number;
}

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_BASE}${path}`);
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function getProfile(): Promise<Profile | null> {
  return fetchJson<Profile>("/profile");
}

export async function getErrors(limit?: number): Promise<ErrorEntry[] | null> {
  const query = limit !== undefined ? `?limit=${limit}` : "";
  return fetchJson<ErrorEntry[]>(`/errors${query}`);
}

export async function getErrorPatterns(): Promise<ErrorPatterns | null> {
  return fetchJson<ErrorPatterns>("/errors/patterns");
}

export async function getFalseFriends(): Promise<FalseFriend[] | null> {
  return fetchJson<FalseFriend[]>("/false-friends");
}

export async function getFalseFriendsByPair(): Promise<
  FalseFriendsByPair[] | null
> {
  return fetchJson<FalseFriendsByPair[]>("/false-friends/by-pair");
}

export async function getRecentDeck(): Promise<RecentDeckCard[] | null> {
  return fetchJson<RecentDeckCard[]>("/errors/recent-deck");
}

export async function getSessions(): Promise<Session[] | null> {
  return fetchJson<Session[]>("/sessions");
}

export async function getReport(
  period?: ReportPeriod,
): Promise<Report | null> {
  const query = period !== undefined ? `?period=${period}` : "";
  return fetchJson<Report>(`/report${query}`);
}

export type Message = {
  role: "user" | "assistant" | "system";
  content: string;
};

export interface ChatModel {
  id: string;
  name: string;
}

export type ChatStreamEvent =
  | { type: "text"; content: string }
  | { type: "text_reset" }
  | { type: "tool_start"; tool: string; display: string }
  | { type: "tool_end"; tool: string }
  | { type: "done" }
  | { type: "error"; message: string };

export type ChatStreamCallbacks = {
  onChunk: (text: string) => void;
  onTextReset: () => void;
  onToolStart: (display: string, tool: string) => void;
  onToolEnd: () => void;
  onDone: () => void;
  onError: (message: string) => void;
};

function parseSseLine(line: string): ChatStreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) {
    return null;
  }
  const payload = trimmed.slice(5).trim();
  if (!payload) {
    return null;
  }
  try {
    return JSON.parse(payload) as ChatStreamEvent;
  } catch {
    return null;
  }
}

function dispatchStreamEvent(
  event: ChatStreamEvent,
  callbacks: ChatStreamCallbacks,
): void {
  switch (event.type) {
    case "text":
      callbacks.onChunk(event.content);
      break;
    case "text_reset":
      callbacks.onTextReset();
      break;
    case "tool_start":
      callbacks.onToolStart(event.display, event.tool);
      break;
    case "tool_end":
      callbacks.onToolEnd();
      break;
    case "done":
      callbacks.onDone();
      break;
    case "error":
      callbacks.onError(event.message);
      break;
  }
}

export async function getModels(): Promise<ChatModel[]> {
  const response = await fetch(`${API_BASE}/models`);
  if (!response.ok) {
    throw new Error("Failed to load models. Check that the API is running.");
  }
  const data = (await response.json()) as ChatModel[];
  return Array.isArray(data) ? data : [];
}

export async function sendMessage(
  messages: Message[],
  model: string,
  callbacks: ChatStreamCallbacks,
): Promise<void> {
  const response = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, model }),
  });

  if (!response.ok) {
    let message = "Something went wrong. Please try again.";
    try {
      const data: unknown = await response.json();
      if (
        typeof data === "object" &&
        data !== null &&
        "error" in data &&
        typeof (data as { error: unknown }).error === "string"
      ) {
        message = (data as { error: string }).error;
      }
    } catch {
      // Response may not be JSON when streaming fails early.
    }
    callbacks.onError(message);
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError("No response body from server.");
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let finished = false;

  const handleEvent = (event: ChatStreamEvent) => {
    if (event.type === "done") {
      finished = true;
    }
    if (event.type === "error") {
      finished = true;
    }
    dispatchStreamEvent(event, callbacks);
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const event = parseSseLine(line);
        if (event) {
          handleEvent(event);
        }
      }
    }

    buffer += decoder.decode();
    for (const line of buffer.split("\n")) {
      const event = parseSseLine(line);
      if (event) {
        handleEvent(event);
      }
    }

    if (!finished) {
      callbacks.onDone();
    }
  } catch (err) {
    callbacks.onError(
      err instanceof Error ? err.message : "Could not read stream.",
    );
  }
}

export async function deleteReset(): Promise<void> {
  // Adjust the URL if you have a global API_BASE_URL constant
  const response = await fetch(`${API_BASE}/reset`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ confirm: true }),
  });

  if (!response.ok) {
    throw new Error("Failed to reset data");
  }
}
