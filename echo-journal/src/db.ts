import * as SQLite from 'expo-sqlite';
import { Directory, File, Paths } from 'expo-file-system';

// All journal data lives on-device. Nothing is synced or shared.

export type Entry = {
  id: number;
  createdAt: number; // epoch ms
  transcript: string;
  audioUri: string | null;
  durationSec: number;
  mood: number | null; // -2 (heavy) .. 2 (bright); null = not scored
  moodLabel: string | null;
  prompt: string | null; // the prompt this entry answered, if any
};

export type Reflection = {
  id: number;
  weekStart: number;
  createdAt: number;
  summary: string;
  themes: string[];
  wins: string[];
  tensions: string[];
  questions: string[];
  entryCount: number;
};

const db = SQLite.openDatabaseSync('journal.db');
const audioDir = new Directory(Paths.document, 'audio');

export async function initDb() {
  if (!audioDir.exists) audioDir.create({ intermediates: true, idempotent: true });
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at INTEGER NOT NULL,
      transcript TEXT NOT NULL DEFAULT '',
      audio_uri TEXT,
      duration_sec INTEGER NOT NULL DEFAULT 0,
      mood INTEGER,
      mood_label TEXT,
      prompt TEXT
    );
    CREATE TABLE IF NOT EXISTS reflections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      week_start INTEGER NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      body TEXT NOT NULL,
      entry_count INTEGER NOT NULL
    );
  `);
}

type EntryRow = {
  id: number;
  created_at: number;
  transcript: string;
  audio_uri: string | null;
  duration_sec: number;
  mood: number | null;
  mood_label: string | null;
  prompt: string | null;
};

const toEntry = (r: EntryRow): Entry => ({
  id: r.id,
  createdAt: r.created_at,
  transcript: r.transcript,
  audioUri: r.audio_uri,
  durationSec: r.duration_sec,
  mood: r.mood,
  moodLabel: r.mood_label,
  prompt: r.prompt,
});

/** Moves a temporary recording into app storage so it survives cache clears. */
export function persistAudio(tempUri: string): string {
  const src = new File(tempUri);
  const dest = new File(audioDir, `${Date.now()}.m4a`);
  src.moveSync(dest);
  return dest.uri;
}

export async function addEntry(e: Omit<Entry, 'id'>): Promise<number> {
  const res = await db.runAsync(
    `INSERT INTO entries (created_at, transcript, audio_uri, duration_sec, mood, mood_label, prompt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    e.createdAt, e.transcript, e.audioUri, e.durationSec, e.mood, e.moodLabel, e.prompt,
  );
  return res.lastInsertRowId;
}

export async function updateEntry(id: number, patch: Partial<Pick<Entry, 'transcript' | 'mood' | 'moodLabel'>>) {
  const sets: string[] = [];
  const vals: (string | number | null)[] = [];
  if (patch.transcript !== undefined) { sets.push('transcript = ?'); vals.push(patch.transcript); }
  if (patch.mood !== undefined) { sets.push('mood = ?'); vals.push(patch.mood); }
  if (patch.moodLabel !== undefined) { sets.push('mood_label = ?'); vals.push(patch.moodLabel); }
  if (!sets.length) return;
  await db.runAsync(`UPDATE entries SET ${sets.join(', ')} WHERE id = ?`, ...vals, id);
}

export async function listEntries(sinceMs = 0): Promise<Entry[]> {
  const rows = await db.getAllAsync<EntryRow>(
    'SELECT * FROM entries WHERE created_at >= ? ORDER BY created_at DESC', sinceMs,
  );
  return rows.map(toEntry);
}

export async function getEntry(id: number): Promise<Entry | null> {
  const row = await db.getFirstAsync<EntryRow>('SELECT * FROM entries WHERE id = ?', id);
  return row ? toEntry(row) : null;
}

function deleteAudioFile(uri: string | null) {
  if (!uri) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {}
}

export async function deleteEntry(id: number) {
  const e = await getEntry(id);
  deleteAudioFile(e?.audioUri ?? null);
  await db.runAsync('DELETE FROM entries WHERE id = ?', id);
}

export async function deleteAllData() {
  await db.execAsync('DELETE FROM entries; DELETE FROM reflections;');
  try {
    if (audioDir.exists) audioDir.delete();
    audioDir.create({ intermediates: true, idempotent: true });
  } catch {}
}

export async function saveReflection(r: Omit<Reflection, 'id'>) {
  const body = JSON.stringify({
    summary: r.summary, themes: r.themes, wins: r.wins, tensions: r.tensions, questions: r.questions,
  });
  await db.runAsync(
    `INSERT INTO reflections (week_start, created_at, body, entry_count) VALUES (?, ?, ?, ?)
     ON CONFLICT(week_start) DO UPDATE SET created_at = excluded.created_at, body = excluded.body, entry_count = excluded.entry_count`,
    r.weekStart, r.createdAt, body, r.entryCount,
  );
}

export async function listReflections(): Promise<Reflection[]> {
  const rows = await db.getAllAsync<{ id: number; week_start: number; created_at: number; body: string; entry_count: number }>(
    'SELECT * FROM reflections ORDER BY week_start DESC',
  );
  return rows.map((r) => ({
    id: r.id, weekStart: r.week_start, createdAt: r.created_at, entryCount: r.entry_count,
    ...JSON.parse(r.body),
  }));
}

/** Monday 00:00 local time of the week containing `d`. */
export function weekStart(d = new Date()): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x.getTime();
}
