// Public privacy policy (App Store / Play Store require a URL). Keep it in sync with what the
// app and this Worker actually do. Have it reviewed before launch; this is not legal advice.

const UPDATED = '23 October 2026';

export function privacyPage(contact: string): Response {
  const contactLine = contact
    ? `Questions or requests: <a href="mailto:${escapeHtml(contact)}">${escapeHtml(contact)}</a>.`
    : 'Questions or requests: contact the developer through Echo’s App Store or Play Store listing.';

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Echo · Privacy</title>
<style>
body{font-family:-apple-system,system-ui,sans-serif;background:#F7F3EE;color:#2B2622;line-height:1.6;margin:0;padding:32px 16px}
main{max-width:640px;margin:0 auto}h1,h2{font-family:Georgia,serif;font-weight:400}h1{font-size:34px;margin:0 0 4px}
h2{font-size:22px;margin-top:32px}p.meta{color:#8A8178;margin-top:0}a{color:#C8553D}li{margin:6px 0}
</style></head><body><main>
<h1>Echo privacy policy</h1>
<p class="meta">Last updated ${UPDATED}</p>

<p>Echo is a voice journal. Your journal is yours: we keep as little as we can, never sell it, and never share it for advertising.</p>

<h2>What stays on your phone</h2>
<ul>
<li>Your recordings, transcripts, mood labels and weekly reflections are stored only on your device.</li>
<li>Reminders are scheduled locally on your device.</li>
<li>Deleting an entry, using “Delete all my data”, or deleting your account erases this data from your device.</li>
</ul>

<h2>What leaves your phone, and why</h2>
<ul>
<li><strong>Your email address</strong> is stored by our authentication provider (Supabase) so you can sign in. Sign-in codes are emailed through Resend.</li>
<li><strong>A recording or entry text</strong> is sent over an encrypted connection to our server (hosted on Cloudflare) only when Echo transcribes it, scores its mood, writes a reflection or suggests a prompt. Our server passes it to our AI provider (Groq) to produce the result and returns it to your phone. Our server does not save your recordings or journal text.</li>
<li><strong>Basic request logs</strong> (such as time, endpoint and error codes) may be kept by our hosting provider for operating and securing the service. We do not log the content of your entries.</li>
</ul>

<h2>What we never do</h2>
<ul>
<li>Sell or rent your data, or share it with advertisers.</li>
<li>Use your journal to train AI models.</li>
<li>Diagnose you. Echo’s insights are patterns you might explore, not medical or psychological advice. If you are struggling, please reach out to someone you trust or a local crisis line.</li>
</ul>

<h2>Deleting your data</h2>
<p>In Echo, open Settings → Delete account. This deletes your account from our authentication provider and erases all journal data on your device. You can also delete individual entries, or all local data, at any time.</p>

<h2>Children</h2>
<p>Echo is not intended for children under 13 (or the minimum age in your country).</p>

<h2>Changes</h2>
<p>If this policy changes, we will update the date above and, for significant changes, tell you in the app.</p>

<h2>Contact</h2>
<p>${contactLine}</p>
</main></body></html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
    },
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
