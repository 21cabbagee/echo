# Echo

Voice journal with AI reflection. Talk to your journal; get weekly reflections on themes, wins, tensions and questions.

- [`echo-journal/`](echo-journal/): Expo (React Native) app. See its [README](echo-journal/README.md) for setup, architecture and the launch checklist.
- [`echo-api/`](echo-api/): Cloudflare Worker that holds the AI key, verifies Supabase sign-ins and serves the privacy policy.

Secrets are never committed: the app has none, and the Worker's keys are Cloudflare secrets.
For local development, create `echo-api/.dev.vars` (`GROQ_API_KEY=…`) and `echo-journal/.env.local` (see the app README).
