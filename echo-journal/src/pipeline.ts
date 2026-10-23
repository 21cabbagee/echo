import { scoreMood, transcribe, weeklyReflection } from './ai';
import {
  addEntry, getEntry, listEntries, listReflections, persistAudio, saveReflection, updateEntry, weekStart,
} from './db';

/**
 * Saves the recording first (so nothing is lost if the network fails),
 * then transcribes and scores mood. Returns the new entry id.
 */
export async function saveVoiceEntry(opts: {
  tempUri: string;
  durationSec: number;
  prompt: string | null;
}): Promise<{ id: number; error?: string }> {
  const audioUri = persistAudio(opts.tempUri);
  const id = await addEntry({
    createdAt: Date.now(),
    transcript: '',
    audioUri,
    durationSec: opts.durationSec,
    mood: null,
    moodLabel: null,
    prompt: opts.prompt,
  });
  try {
    await processEntry(id);
    return { id };
  } catch (e) {
    return { id, error: (e as Error).message };
  }
}

/** (Re)transcribes an entry if needed and scores its mood. Safe to retry. */
export async function processEntry(id: number) {
  const entry = await getEntry(id);
  if (!entry) return;
  let transcript = entry.transcript;
  if (!transcript && entry.audioUri) {
    transcript = await transcribe(entry.audioUri);
    await updateEntry(id, { transcript });
  }
  if (transcript && entry.mood == null) {
    const { mood, label } = await scoreMood(transcript);
    await updateEntry(id, { mood, moodLabel: label });
  }
}

/**
 * Catches up on entries saved while offline or before the server was reachable.
 * Stops at the first error (likely offline or rate limited) so it doesn't hammer the API.
 */
export async function processPending(): Promise<{ done: number; error?: string }> {
  const pending = (await listEntries()).filter(
    (e) => (!e.transcript && e.audioUri) || (e.transcript && e.mood == null),
  );
  let done = 0;
  for (const e of pending.reverse()) {
    try {
      await processEntry(e.id);
      done++;
    } catch (err) {
      return { done, error: (err as Error).message };
    }
  }
  return { done };
}

export async function saveTextEntry(text: string, prompt: string | null) {
  const id = await addEntry({
    createdAt: Date.now(), transcript: text.trim(), audioUri: null, durationSec: 0,
    mood: null, moodLabel: null, prompt,
  });
  processEntry(id).catch(() => {});
  return id;
}

export const MIN_ENTRIES_FOR_REFLECTION = 3;

/**
 * Writes last week's reflection once the week is over, so it's waiting on Monday
 * without the user having to ask. Returns true if a new reflection was saved.
 */
export async function autoReflectLastWeek(): Promise<boolean> {
  const thisWeek = weekStart();
  const lastWeek = weekStart(new Date(thisWeek - 1));
  if ((await listReflections()).some((r) => r.weekStart === lastWeek)) return false;
  const entries = (await listEntries(lastWeek)).filter((e) => e.createdAt < thisWeek && e.transcript);
  if (entries.length < MIN_ENTRIES_FOR_REFLECTION) return false;
  const r = await weeklyReflection(entries);
  await saveReflection({ ...r, weekStart: lastWeek, createdAt: Date.now(), entryCount: entries.length });
  return true;
}
