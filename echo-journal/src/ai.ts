import Constants from 'expo-constants';
import { File } from 'expo-file-system';
import type { Entry } from './db';
import { getAccessToken, supabase } from './supabase';

// All AI work goes through the Echo API (../echo-api), which holds the Groq key.
// The app ships no secrets.

/**
 * EXPO_PUBLIC_API_URL wins (set it to the deployed Worker URL).
 * In development it falls back to the local Worker, reached through Metro's
 * /echo-api proxy (see metro.config.js) since the phone can already reach Metro.
 */
function resolveApiUrl() {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const hostUri = Constants.expoConfig?.hostUri;
  return hostUri ? `http://${hostUri}/echo-api` : '';
}

export const API_URL = resolveApiUrl();

export class AiError extends Error {}

/** Calls the Echo API as the signed-in user. Retries once after refreshing an expired session. */
async function api<T>(path: string, init: RequestInit, retried = false): Promise<T> {
  if (!API_URL) throw new AiError('No AI server configured. Set EXPO_PUBLIC_API_URL.');
  const token = await getAccessToken();
  if (!token) throw new AiError('Sign in to use AI features.');
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
    });
  } catch (e) {
    if (__DEV__) console.warn(`[echo-api] ${init.method ?? 'GET'} ${API_URL}${path} failed:`, String(e));
    throw new AiError("Can't reach the AI server. Check your connection and try again.");
  }
  if (res.status === 401 && !retried) {
    const { error } = await supabase.auth.refreshSession();
    if (!error) return api<T>(path, init, true);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new AiError(data.error ?? `AI server error ${res.status}.`);
  return data as T;
}

const postJson = <T>(path: string, body: unknown) =>
  api<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

/** Permanently deletes the signed-in user's account on the server. */
export async function deleteAccount(): Promise<void> {
  await api<{ deleted: boolean }>('/v1/account', { method: 'DELETE' });
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/health`);
    return res.ok;
  } catch (e) {
    if (__DEV__) console.warn(`[echo-api] health ${API_URL}/health failed:`, String(e));
    return false;
  }
}

export async function transcribe(audioUri: string): Promise<string> {
  const form = new FormData();
  // Expo's global fetch (expo/fetch) rejects React Native's { uri, name, type } parts;
  // it needs a Blob-like object with bytes(), which expo-file-system's File provides.
  form.append('file', new File(audioUri) as unknown as Blob, 'entry.m4a');
  const r = await api<{ text: string }>('/v1/transcribe', { method: 'POST', body: form });
  return r.text;
}

export function scoreMood(transcript: string) {
  return postJson<{ mood: number; label: string }>('/v1/mood', { transcript });
}

export type WeeklyReflection = {
  summary: string;
  themes: string[];
  wins: string[];
  tensions: string[];
  questions: string[];
};

const toPayload = (entries: Entry[]) =>
  entries
    .filter((e) => e.transcript)
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((e) => ({ date: new Date(e.createdAt).toDateString(), text: e.transcript }));

export function weeklyReflection(entries: Entry[]) {
  return postJson<WeeklyReflection>('/v1/reflect', { entries: toPayload(entries) });
}

const STARTER_PROMPTS = [
  "What's taking up the most space in your head right now?",
  'What was the best part of today, even if it was small?',
  "What's something you're looking forward to?",
  'How is your energy today, and what drained or fed it?',
  "What's one thing you'd like to let go of this week?",
  'Who did you connect with recently, and how did it feel?',
  'What would make tomorrow a good day?',
];

export function fallbackPrompt(seed = new Date().getDate()) {
  return STARTER_PROMPTS[seed % STARTER_PROMPTS.length];
}

export async function dailyPrompt(recent: Entry[]): Promise<string> {
  const entries = toPayload(recent.slice(0, 5));
  if (!entries.length) return fallbackPrompt();
  const r = await postJson<{ prompt: string }>('/v1/prompt', { entries });
  return r.prompt || fallbackPrompt();
}
