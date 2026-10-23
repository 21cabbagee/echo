import 'expo-sqlite/localStorage/install';
import './cryptoPolyfill';
import { createClient, Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';

// Both values are public by design (the anon key only grants what Row Level Security allows).
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';

export const supabaseConfigured = !!SUPABASE_URL && !!SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL || 'http://localhost', SUPABASE_ANON_KEY || 'missing', {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

// Supabase recommends refreshing tokens only while the app is in the foreground on React Native.
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

/** undefined while loading, null when signed out. */
export function useSession() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return session;
}

export async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

const API_URL = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/, '') ?? '';

/**
 * Where Supabase should send the user after auth, and the app URL that finally receives it.
 * Supabase rejects Expo Go's exp://<lan-ip>:<port> URLs, so in Expo Go we bounce through the
 * Echo API's /auth/callback page. Standalone builds use echo://auth-callback directly.
 */
function authRedirect() {
  const appUrl = Linking.createURL('auth-callback');
  const viaBounce = appUrl.startsWith('exp://') && API_URL.startsWith('https://');
  const redirectTo = viaBounce ? `${API_URL}/auth/callback?to=${encodeURIComponent(appUrl)}` : appUrl;
  return { appUrl, redirectTo };
}

/**
 * Emails a magic link. Supabase's built-in mailer only sends links (codes need custom SMTP to edit
 * the template). The link must be opened on this device: PKCE keeps the code verifier here.
 */
export async function sendEmailLink(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { shouldCreateUser: true, emailRedirectTo: authRedirect().redirectTo },
  });
  if (error) throw error;
}

/** Signs in with the one-time code from the same email (needs {{ .Token }} in the template). */
export async function verifyEmailCode(email: string, token: string) {
  const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: token.trim(), type: 'email' });
  if (error) throw error;
}

// A redirect can reach us twice (auth session result + app link), and codes are single-use.
const exchangedCodes = new Set<string>();

/** Finishes a PKCE sign-in from a redirect URL (magic link or OAuth). Returns false if it isn't one. */
async function completeAuthFromUrl(url: string): Promise<boolean> {
  const { path, queryParams } = Linking.parse(url);
  if (!path?.endsWith('auth-callback')) return false;
  const errorDescription = queryParams?.error_description;
  if (errorDescription) throw new Error(String(errorDescription));
  const code = queryParams?.code;
  if (!code) throw new Error('The sign-in link did not include a code.');
  if (exchangedCodes.has(String(code))) return true;
  exchangedCodes.add(String(code));
  const { error } = await supabase.auth.exchangeCodeForSession(String(code));
  if (error) throw error;
  return true;
}

/** Signs the user in when a magic link reopens the app. */
export function useAuthDeepLinks() {
  const url = Linking.useLinkingURL();
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!url || handled.current === url) return;
    handled.current = url;
    completeAuthFromUrl(url).catch((e) =>
      Alert.alert('Sign-in link didn’t work', `${(e as Error).message}\n\nRequest a new link and open it on this phone.`),
    );
  }, [url]);
}

/**
 * Google sign-in through Supabase's hosted OAuth page in an in-app browser session,
 * which works in Expo Go (no native Google SDK needed). PKCE keeps the code exchange safe.
 * Returns false if the user closed the browser.
 */
export async function signInWithGoogle(): Promise<boolean> {
  const { appUrl, redirectTo } = authRedirect();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;

  const result = await WebBrowser.openAuthSessionAsync(data.url, appUrl);
  if (result.type !== 'success') return false;
  return completeAuthFromUrl(result.url);
}

export async function signOut() {
  await supabase.auth.signOut();
}

/** Clears the session on this device only (the server-side user may already be gone). */
export async function signOutLocally() {
  await supabase.auth.signOut({ scope: 'local' });
}
