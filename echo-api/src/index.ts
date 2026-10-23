// Echo API: the only place the Groq key lives.
// Exposes four narrow endpoints (not a general LLM proxy) to signed-in Supabase users only,
// so a leaked app bundle can't be used to run arbitrary prompts on our key.

import { AuthEnv, AuthError, deleteUser, requireUser } from './auth';
import { authCallback } from './authCallback';
import { privacyPage } from './privacy';

export interface Env extends AuthEnv {
  GROQ_API_KEY: string;
  /** Optional contact email shown on /privacy. */
  PRIVACY_CONTACT?: string;
  /** Cloudflare Rate Limiting binding (wrangler.jsonc). Optional so local tests without it still run. */
  USER_LIMITER?: RateLimit;
}

const GROQ_BASE = 'https://api.groq.com/openai/v1';
// Swap these if Groq retires a model: https://console.groq.com/docs/models
const STT_MODEL = 'whisper-large-v3-turbo';
const LLM_MODEL = 'openai/gpt-oss-120b';

const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // Groq's upload limit
const MAX_TRANSCRIPT_CHARS = 20_000;
const MAX_ENTRIES = 50;
const MAX_TOTAL_CHARS = 60_000;
const RATE_LIMIT_PER_HOUR = 120;

const SYSTEM = `You are a warm, perceptive journaling companion. You reflect patterns back to the user so they can explore them.
Rules:
- Never diagnose, label disorders, or give medical advice. Frame observations as "patterns you might explore".
- Be specific: reference what the user actually said. No generic platitudes.
- Speak directly to the user as "you". Keep it short.
- If entries mention self-harm or crisis, gently suggest reaching out to someone they trust or a local crisis line.`;

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// Best-effort, per-isolate, per-user limiter. Swap for Cloudflare's rate-limit
// binding (or a Durable Object) when you need it to hold across isolates.
const hits = new Map<string, { windowStart: number; count: number }>();
function rateLimit(userId: string) {
  const now = Date.now();
  const h = hits.get(userId);
  if (!h || now - h.windowStart > 3_600_000) {
    hits.set(userId, { windowStart: now, count: 1 });
    return;
  }
  if (++h.count > RATE_LIMIT_PER_HOUR) throw new HttpError(429, 'Too many requests. Try again later.');
}

async function groq(env: Env, path: string, init: RequestInit) {
  if (!env.GROQ_API_KEY) throw new HttpError(500, 'Server is missing GROQ_API_KEY.');
  const res = await fetch(`${GROQ_BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${env.GROQ_API_KEY}`, ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('groq error', res.status, body.slice(0, 500));
    if (res.status === 429) throw new HttpError(429, 'The AI is busy right now. Try again in a minute.');
    throw new HttpError(502, 'The AI service had a problem. Try again shortly.');
  }
  return res.json<any>();
}

async function chatJson<T>(env: Env, user: string, maxTokens: number): Promise<T> {
  const data = await groq(env, '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: LLM_MODEL,
      temperature: 0.6,
      // gpt-oss reasons before answering and those tokens count toward max_tokens,
      // so keep effort low and leave headroom or JSON mode fails with an empty answer.
      reasoning_effort: 'low',
      max_tokens: maxTokens + 600,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: user },
      ],
    }),
  });
  try {
    return JSON.parse(data.choices?.[0]?.message?.content ?? '{}') as T;
  } catch {
    throw new HttpError(502, 'The AI returned something unreadable. Try again.');
  }
}

type EntryIn = { date: string; text: string };

function readEntries(body: any): EntryIn[] {
  const entries = Array.isArray(body?.entries) ? body.entries : null;
  if (!entries || entries.length === 0) throw new HttpError(400, 'entries is required.');
  if (entries.length > MAX_ENTRIES) throw new HttpError(400, `At most ${MAX_ENTRIES} entries.`);
  const out = entries.map((e: any) => ({ date: String(e?.date ?? '').slice(0, 40), text: String(e?.text ?? '') }));
  if (out.reduce((n: number, e: EntryIn) => n + e.text.length, 0) > MAX_TOTAL_CHARS) {
    throw new HttpError(413, 'Entries are too long.');
  }
  return out;
}

const fmtEntries = (entries: EntryIn[]) => entries.map((e) => `[${e.date}] ${e.text}`).join('\n\n');
const strArr = (v: unknown) => (Array.isArray(v) ? v.map(String).filter(Boolean).slice(0, 6) : []);

async function transcribe(req: Request, env: Env) {
  const len = Number(req.headers.get('Content-Length') ?? 0);
  if (len > MAX_AUDIO_BYTES) throw new HttpError(413, 'Recording is too long.');
  const form = await req.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') throw new HttpError(400, 'file is required.');
  if (file.size > MAX_AUDIO_BYTES) throw new HttpError(413, 'Recording is too long.');

  const out = new FormData();
  out.append('file', file, file.name || 'entry.m4a');
  out.append('model', STT_MODEL);
  out.append('response_format', 'json');
  const data = await groq(env, '/audio/transcriptions', { method: 'POST', body: out });
  return { text: String(data.text ?? '').trim() };
}

async function mood(body: any, env: Env) {
  const transcript = String(body?.transcript ?? '');
  if (!transcript.trim()) throw new HttpError(400, 'transcript is required.');
  if (transcript.length > MAX_TRANSCRIPT_CHARS) throw new HttpError(413, 'Entry is too long.');
  const r = await chatJson<{ mood: number; label: string }>(
    env,
    `Read this journal entry and estimate its overall emotional tone.
Return JSON: {"mood": integer from -2 (heavy) to 2 (bright), "label": one or two lowercase words, e.g. "hopeful", "drained", "restless"}.

Entry:
${transcript}`,
    60,
  );
  return {
    mood: Math.max(-2, Math.min(2, Math.round(Number(r.mood) || 0))),
    label: String(r.label ?? '').slice(0, 24),
  };
}

async function reflect(body: any, env: Env) {
  const entries = readEntries(body);
  const r = await chatJson<Record<string, unknown>>(
    env,
    `Here are my journal entries from this week. Write my weekly reflection.
Return JSON:
{
  "summary": "2-3 sentences on how my week seemed to go",
  "themes": ["2-4 recurring themes, each a short phrase"],
  "wins": ["1-3 things that went well or that I handled well"],
  "tensions": ["1-3 tensions, frictions or unresolved threads, framed gently"],
  "questions": ["2-3 open questions I might explore in next week's entries"]
}

Entries:
${fmtEntries(entries)}`,
    900,
  );
  return {
    summary: String(r.summary ?? ''),
    themes: strArr(r.themes),
    wins: strArr(r.wins),
    tensions: strArr(r.tensions),
    questions: strArr(r.questions),
  };
}

async function prompt(body: any, env: Env) {
  const entries = readEntries(body).slice(-5);
  const r = await chatJson<{ prompt: string }>(
    env,
    `Based on my recent journal entries, suggest ONE short, open-ended question for today's entry.
It should gently follow up on something I mentioned, not repeat a question I've already answered.
Return JSON: {"prompt": "..."}

Recent entries:
${fmtEntries(entries)}`,
    120,
  );
  return { prompt: String(r.prompt ?? '').slice(0, 300) };
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(req.url);
    try {
      if (req.method === 'GET' && pathname === '/health') return json({ ok: true });
      if (req.method === 'GET' && pathname === '/auth/callback') return authCallback(req);
      if (req.method === 'GET' && pathname === '/privacy') return privacyPage(env.PRIVACY_CONTACT ?? '');
      if (req.method === 'DELETE' && pathname === '/v1/account') {
        // Deletes only the account the verified token belongs to; there is no user id parameter.
        const userId = await requireUser(req, env);
        try {
          await deleteUser(userId, env);
        } catch (e) {
          throw new HttpError(502, (e as Error).message);
        }
        return json({ deleted: true });
      }
      if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed.');

      const userId = await requireUser(req, env);
      rateLimit(userId);
      if (env.USER_LIMITER && !(await env.USER_LIMITER.limit({ key: userId })).success) {
        throw new HttpError(429, 'Too many requests. Try again in a minute.');
      }

      switch (pathname) {
        case '/v1/transcribe':
          return json(await transcribe(req, env));
        case '/v1/mood':
          return json(await mood(await req.json(), env));
        case '/v1/reflect':
          return json(await reflect(await req.json(), env));
        case '/v1/prompt':
          return json(await prompt(await req.json(), env));
        default:
          throw new HttpError(404, 'Not found.');
      }
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      if (e instanceof AuthError) return json({ error: e.message }, 401);
      console.error('unhandled', e);
      return json({ error: 'Something went wrong.' }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
