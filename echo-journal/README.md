# Echo — voice journal with AI reflection

Talk to your journal; get weekly reflections on themes, wins, tensions and questions.

Two projects side by side:

- `echo-journal/`: the Expo app. Ships **no secrets**.
- `echo-api/`: a Cloudflare Worker that holds the Groq key, verifies Supabase sign-ins, and exposes four narrow endpoints.

Live API: `https://echo-api.echo21.workers.dev` · Supabase project: `echo` (`okvwlzidluewpqqivpkp`).

## Run it locally

```bash
# terminal 1: the AI server (reads GROQ_API_KEY from echo-api/.dev.vars)
cd echo-api && npm install && npm run dev

# terminal 2: the app
cd echo-journal && npm install && npx expo start
```

Scan the QR code with **Expo Go** (signed in to the same Expo account as the CLI).
In development the app finds the Worker automatically on the same machine as Metro (port 8787).

## Stack (all free tiers)

| Piece | Choice |
|---|---|
| App | Expo SDK 58 / React Native, runs in Expo Go |
| Storage | `expo-sqlite` + files in the app's document dir, on-device only |
| Accounts | Supabase Auth: 6-digit email code (Resend SMTP), Google via OAuth (provider not enabled yet) |
| AI server | Cloudflare Worker (`echo-api/`), 100k requests a day free |
| Transcription | Groq `whisper-large-v3-turbo` |
| Reflections, prompts, mood | Groq `openai/gpt-oss-120b` (JSON mode, low reasoning effort) |

## API (`echo-api/src/index.ts`)

All `POST` endpoints require `Authorization: Bearer <Supabase access token>`. The Worker verifies it against the
project's JWKS (ES256), rejects anonymous users, and rate-limits per user. `GET /auth/callback` is the hand-off
page described below.

| Endpoint | Body | Returns |
|---|---|---|
| `GET /health` | none | `{ ok }` |
| `POST /v1/transcribe` | multipart `file` (≤25 MB) | `{ text }` |
| `POST /v1/mood` | `{ transcript }` | `{ mood: -2..2, label }` |
| `POST /v1/reflect` | `{ entries: [{ date, text }] }` | `{ summary, themes, wins, tensions, questions }` |
| `POST /v1/prompt` | `{ entries: [{ date, text }] }` | `{ prompt }` |
| `DELETE /v1/account` | none | `{ deleted }`: deletes the caller's own Supabase user |
| `GET /privacy` | none | Public privacy policy (set `PRIVACY_CONTACT` var for a contact email) |

Limits: 30 requests/min per user (Cloudflare Rate Limiting binding `USER_LIMITER`) plus a 120/hour in-memory cap.

Prompts and the non-diagnostic guardrails (`SYSTEM`) live on the server, so they can change without an app release,
and the key can't be used to run arbitrary prompts.

## Sign-in setup (Supabase)

- **Email:** custom SMTP via Resend (`smtp.resend.com:465`, user `resend`, sender `onboarding@resend.dev`).
  The Magic link and Confirm signup templates include `{{ .Token }}`; OTP length 6, expiry 900 s, 30 emails/h.
  Until a domain is verified in Resend, emails only reach the Resend account owner's address.
- **Redirect URLs:** `exp://**`, `echo://**`, `https://echo-api.echo21.workers.dev/auth/callback**`.
  Supabase rejects Expo Go's `exp://<lan-ip>:<port>` URLs, so in Expo Go the app redirects through the
  Worker's `/auth/callback` page (only forwards to `exp://`/`echo://`). Standalone builds use `echo://auth-callback`.
- **PKCE:** `src/cryptoPolyfill.ts` backs `crypto.getRandomValues` and `crypto.subtle.digest` with expo-crypto,
  otherwise supabase-js downgrades to the plain challenge.
- **Google:** create a Web OAuth client in Google Cloud with redirect
  `https://okvwlzidluewpqqivpkp.supabase.co/auth/v1/callback`, then enable Google in Supabase with its ID and secret.

## Deploy the AI server

```bash
cd echo-api
npx wrangler login                      # opens Cloudflare in your browser
npx wrangler secret put GROQ_API_KEY         # paste the key at the prompt
npx wrangler secret put SUPABASE_SECRET_KEY  # sb_secret_… key; only used for account deletion
npx wrangler deploy --secrets-file .dev.vars   # SUPABASE_URL/ANON_KEY are vars in wrangler.jsonc
```

Then put that URL in `echo-journal/.env.local` as `EXPO_PUBLIC_API_URL=...` and restart Expo.

## Rotating the Groq key

1. console.groq.com/keys → create a new key → delete the old one.
2. Local: replace the value in `echo-api/.dev.vars` and restart `npm run dev`.
3. Production: `npx wrangler secret put GROQ_API_KEY`. No app release needed.

## App layout

- `src/db.ts`: SQLite schema, entries, reflections, delete-all
- `src/ai.ts`: client for the Echo API, plus fallback prompts
- `src/pipeline.ts`: save audio first, then transcribe and score mood; catches up on launch and foreground
- `src/screens/`: Journal (record and prompt), Reflect (weekly and mood trend), Entry detail, Settings
- `src/settings.ts`: Pro flag, free-tier limit (7 entries/week)

## Reminders and weekly reflections

- Settings → Reminders schedules a local daily nudge (8 am / 8 pm / 10 pm) and a Monday 9 am
  "weekly reflection" notification (`src/reminders.ts`). Tapping them opens Journal or Reflect.
- On launch/foreground, `autoReflectLastWeek()` writes last week's reflection if it had ≥3 transcribed entries.

## App icon

`python3 scripts/make-icons.py` regenerates `assets/` (icon, Android adaptive layers, splash, favicon).

## AI consent

After sign-in, Echo asks once before any recording or text goes to the AI provider (Apple guideline 5.1.2(i)).
"Continue without AI" keeps journaling fully on-device. It can be changed in Settings → AI; `src/ai.ts` refuses
AI calls without consent.

## Freemium

Free: 7 entries/week plus the weekly reflection. Pro: unlimited entries, AI daily prompts, and mood trends.
`PAYMENTS_ENABLED` in `src/settings.ts` is `false` until RevenueCat and store products exist: everyone gets all features and no paywall shows (stores reject unpurchasable paywalls).

## Next before real users

- Verify a sending domain in Resend so codes reach any email address; enable Google sign-in.
- Swap the in-memory limiter for Cloudflare's rate-limit binding.
- Real payments (RevenueCat), with the free-tier limit enforced server-side.
- A weekly reminder notification (`expo-notifications`).
