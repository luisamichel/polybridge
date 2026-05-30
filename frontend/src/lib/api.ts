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
