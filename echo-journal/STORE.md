# Echo: store listing and submission runbook

Everything here is ready to paste. With an Apple Developer account in hand, iOS submission is about an hour.

## Listing copy

**Name:** Echo: Voice Journal
**Subtitle (iOS, ≤30):** Talk it out. See your patterns.
**Short description (Play, ≤80):** Talk to your journal. Get a weekly AI reflection on themes, wins and moods.
**Category:** Lifestyle (secondary: Health & Fitness is *not* recommended; Echo makes no health claims)
**Age rating:** 18+ in the policy; answer the questionnaire honestly (no objectionable content) → 4+/Everyone is fine on the store side, but the privacy policy limits use to 18+.
**Keywords (iOS, ≤100):** journal,voice journal,diary,reflection,mood,self-awareness,habit,mindfulness,prompts

**Description**

> Journaling is hard to keep up, and written diaries rarely tell you anything back. Echo changes both.
>
> Tap, talk for thirty seconds, done. Echo turns your voice into text and, each week, writes you a short reflection: the themes that kept coming up, what went well, the tensions worth exploring, and a few questions to sit with.
>
> • Voice-first: record an entry in seconds, or type if you prefer
> • Daily prompts that follow up on what you actually said
> • A weekly reflection on themes, wins and tensions
> • Gentle mood trends over four weeks
> • Reminders at a time that suits you
>
> Private by design: your entries live on your phone. AI features are opt-in, nothing is sold or used to train AI, and you can delete your account anytime from Settings.
>
> Echo offers patterns you might explore, never diagnoses. If you’re struggling, please reach out to someone you trust or a local crisis line.
>
> Free: 7 entries a week and a weekly reflection. Echo Pro: unlimited entries, personalized prompts and mood trends.

**Privacy policy URL:** https://echo-api.echo21.workers.dev/privacy
**Support URL:** https://echo-api.echo21.workers.dev/privacy (until a site exists) · support email: see policy

## App Store “App Privacy” answers (nutrition label)

| Data type | Collected | Linked to user | Tracking | Purpose |
|---|---|---|---|---|
| Email address | Yes | Yes | No | App functionality (sign-in) |
| Audio data | Yes* | No | No | App functionality (transcription) |
| Other user content (journal text) | Yes* | No | No | App functionality (reflections) |

\*Only when AI features are on; processed and not stored by us. No analytics, no ads, no tracking (no ATT prompt needed).

## Google Play “Data safety” answers

- Data collected: Email address (account management), Audio (app functionality), Other user-generated content (app functionality).
- Shared with third parties: Audio and text are *processed* by a service provider (Groq) on our behalf. Under Play’s definitions, service-provider processing is not “sharing”.
- Encrypted in transit: Yes. Users can request deletion: Yes (in-app Delete account).

## Review notes (paste into App Review / Play review)

> Sign in with an email code. For review, use the demo account below. AI features are opt-in on first launch (Apple 5.1.2(i) disclosure) and can be toggled in Settings → AI. Account deletion: Settings → Account → Delete account.

Demo account: create one with a reviewer-accessible inbox once the Resend domain is verified (codes only reach the Resend owner until then).

## Screenshots (needed)

iPhone 6.9" (1320×2868) ×3–5 and Android phone ×2+: Journal with prompt, recording, entry with transcript, weekly reflection, mood trend. Take them in a dev build; avoid real personal entries.

## Runbook

**Android (free, now):** `EAS_NO_VCS=1 npx eas-cli build -p android --profile preview` → share the APK link with testers (Settings → allow install from unknown sources).
**Google Play ($25 one-time, later):** `npx eas-cli build -p android --profile production` → `npx eas-cli submit -p android`.

**iOS (needs an Apple Developer account, $99/yr or someone's team):**
1. Have the account owner add you to their team (App Manager role), or log in with their Apple ID when EAS asks.
2. In App Store Connect: create the app with bundle ID `in.solution24x7.echo`, name “Echo: Voice Journal”.
3. `npx eas-cli build -p ios --profile production`: EAS creates certificates and profiles.
4. `npx eas-cli submit -p ios`: uploads to TestFlight.
5. Fill in the listing, privacy answers and review notes above; submit for review.

**Before submitting anywhere:** Resend domain verified (so reviewers can get codes), Google sign-in enabled or the button hidden, privacy contact set (`PRIVACY_CONTACT` in `echo-api/wrangler.jsonc`), and payments either wired (RevenueCat) or Pro hidden. Apple rejects paywalls that can’t be purchased.
