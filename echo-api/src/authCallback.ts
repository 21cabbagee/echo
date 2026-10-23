// Hand-off page for Supabase auth redirects during development in Expo Go.
// Supabase's redirect allow-list rejects Expo Go's exp://<lan-ip>:<port>/... URLs, so the app asks
// Supabase to redirect here (an https URL it accepts) and this page forwards the result to the app.
// Only app schemes are allowed as targets, and the forwarded PKCE code is useless without the
// verifier that stays on the phone that started sign-in.

const ALLOWED_TARGET = /^(exp|echo):\/\/[^\s"'<>]+$/;

export function authCallback(req: Request): Response {
  const url = new URL(req.url);
  const to = url.searchParams.get('to') ?? '';
  if (!ALLOWED_TARGET.test(to)) {
    return new Response('Invalid sign-in redirect.', { status: 400, headers: { 'Content-Type': 'text/plain' } });
  }

  // Forward everything except our own `to` param. Errors may also arrive in the #fragment,
  // which only the browser can see, so the page forwards it client-side.
  url.searchParams.delete('to');
  const query = url.searchParams.toString();
  const target = query ? `${to}${to.includes('?') ? '&' : '?'}${query}` : to;

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Opening Echo…</title>
<style>body{font-family:-apple-system,system-ui,sans-serif;background:#F7F3EE;color:#2B2622;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;text-align:center;padding:24px}
a{display:inline-block;margin-top:16px;padding:14px 22px;border-radius:999px;background:#2B2622;color:#fff;text-decoration:none;font-weight:600}</style>
</head><body><div><h1 style="font-family:Georgia,serif;font-weight:400">Echo</h1><p>Tap the button to finish signing in.</p>
<a id="open" href="#">Open Echo</a>
<p style="color:#8A8178;font-size:14px;margin-top:20px">If iOS asks, choose Open. Use this link within a few minutes.</p></div>
<script>
var target = ${JSON.stringify(target)};
if (location.hash) target += (target.indexOf('#') === -1 ? location.hash : '');
document.getElementById('open').href = target;
location.replace(target);
</script></body></html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'",
    },
  });
}
