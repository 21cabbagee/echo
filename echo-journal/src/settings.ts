import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useState } from 'react';

const KEY_PRO = 'is_pro';
// Versioned so a materially different disclosure can ask again.
const KEY_AI_CONSENT = 'ai_consent_v1';

export const FREE_ENTRIES_PER_WEEK = 7;

/**
 * Off until real purchases exist (RevenueCat + store products). While off, everyone gets every
 * feature and no upsell is shown: stores reject paywalls that can't actually be bought.
 */
export const PAYMENTS_ENABLED = false;

export async function getIsPro() {
  return (await SecureStore.getItemAsync(KEY_PRO)) === '1';
}

export async function setIsPro(v: boolean) {
  await SecureStore.setItemAsync(KEY_PRO, v ? '1' : '0');
}

/**
 * Explicit permission to send recordings and entry text to the third-party AI provider
 * (Apple guideline 5.1.2(i)). null = not asked yet.
 */
export type AiConsent = 'granted' | 'declined' | null;

// Cached so every AI call can check synchronously; kept in sync by get/set below.
let aiConsentCache: AiConsent = null;

export function aiAllowed() {
  return aiConsentCache === 'granted';
}

export async function getAiConsent(): Promise<AiConsent> {
  const v = await SecureStore.getItemAsync(KEY_AI_CONSENT);
  aiConsentCache = v === 'granted' || v === 'declined' ? v : null;
  return aiConsentCache;
}

export async function setAiConsent(v: 'granted' | 'declined') {
  await SecureStore.setItemAsync(KEY_AI_CONSENT, v);
  aiConsentCache = v;
}

export function useSettings() {
  const [isPro, setPro] = useState(false);
  const [aiConsent, setConsent] = useState<AiConsent>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => Promise.all([getIsPro(), getAiConsent()]), []);

  const reload = useCallback(async () => {
    const [p, c] = await load();
    setPro(p);
    setConsent(c);
    setLoaded(true);
  }, [load]);

  useEffect(() => {
    load().then(([p, c]) => {
      setPro(p);
      setConsent(c);
      setLoaded(true);
    });
  }, [load]);

  return { isPro: PAYMENTS_ENABLED ? isPro : true, aiConsent, loaded, reload };
}
