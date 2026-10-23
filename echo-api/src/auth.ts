import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify } from 'jose';

export type AuthEnv = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  /** Secret (sb_secret_…) or legacy service_role key. Only used to delete the caller's own account. */
  SUPABASE_SECRET_KEY?: string;
};

export class AuthError extends Error {}

// Cached per isolate; jose refetches when it sees an unknown key id (key rotation).
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let jwksFor = '';

function getJwks(supabaseUrl: string) {
  if (!jwks || jwksFor !== supabaseUrl) {
    jwks = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));
    jwksFor = supabaseUrl;
  }
  return jwks;
}

/**
 * Returns the Supabase user id for a request, or throws AuthError.
 * Projects on asymmetric signing keys (the default) are verified locally against the JWKS.
 * Legacy HS256 projects can't be verified without the shared secret, so we ask Supabase instead.
 */
export async function requireUser(req: Request, env: AuthEnv): Promise<string> {
  if (!env.SUPABASE_URL) throw new Error('Server is missing SUPABASE_URL.');
  const header = req.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw new AuthError('Sign in to use AI features.');

  let alg: string | undefined;
  try {
    alg = decodeProtectedHeader(token).alg;
  } catch {
    throw new AuthError('Invalid session. Sign in again.');
  }

  if (alg === 'HS256') return verifyWithSupabase(token, env);

  try {
    const { payload } = await jwtVerify(token, getJwks(env.SUPABASE_URL), {
      issuer: `${env.SUPABASE_URL}/auth/v1`,
      audience: 'authenticated',
    });
    if (!payload.sub) throw new AuthError('Invalid session. Sign in again.');
    if (payload.is_anonymous === true) throw new AuthError('Sign in to use AI features.');
    return payload.sub;
  } catch (e) {
    if (e instanceof AuthError) throw e;
    const code = (e as { code?: string }).code;
    if (code === 'ERR_JWT_EXPIRED') throw new AuthError('Session expired. Sign in again.');
    throw new AuthError('Invalid session. Sign in again.');
  }
}

async function verifyWithSupabase(token: string, env: AuthEnv): Promise<string> {
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
  });
  if (!res.ok) throw new AuthError('Invalid session. Sign in again.');
  const user = await res.json<{ id?: string; is_anonymous?: boolean }>();
  if (!user.id || user.is_anonymous) throw new AuthError('Sign in to use AI features.');
  return user.id;
}

/** Permanently deletes a Supabase Auth user. Callers must pass the id from a verified token. */
export async function deleteUser(userId: string, env: AuthEnv): Promise<void> {
  const key = env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error('Server is missing SUPABASE_SECRET_KEY.');
  // New sb_secret_ keys go in the apikey header only; legacy service_role keys are JWTs and also
  // need to be the bearer token.
  const headers: Record<string, string> = { apikey: key };
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers,
  });
  // 404 means it's already gone, which is the outcome the user asked for.
  if (!res.ok && res.status !== 404) {
    const body = await res.text().catch(() => '');
    console.error('delete user failed', res.status, body.slice(0, 300));
    throw new Error(`Supabase refused to delete the account (${res.status}).`);
  }
}
