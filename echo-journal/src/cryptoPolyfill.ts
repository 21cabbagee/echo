import * as ExpoCrypto from 'expo-crypto';

// Supabase's PKCE needs crypto.getRandomValues (else it falls back to Math.random) and
// crypto.subtle.digest('SHA-256') (else it downgrades to the "plain" challenge method).
// React Native has neither by default, so back them with expo-crypto.
type MinimalCrypto = {
  getRandomValues?: typeof ExpoCrypto.getRandomValues;
  subtle?: { digest: (algorithm: string | { name: string }, data: BufferSource) => Promise<ArrayBuffer> };
};

const g = globalThis as unknown as { crypto?: MinimalCrypto };
g.crypto ??= {};

if (typeof g.crypto.getRandomValues !== 'function') {
  g.crypto.getRandomValues = ExpoCrypto.getRandomValues;
}

if (!g.crypto.subtle) {
  g.crypto.subtle = {
    digest(algorithm, data) {
      const name = typeof algorithm === 'string' ? algorithm : algorithm.name;
      if (name.toUpperCase() !== 'SHA-256') {
        return Promise.reject(new Error(`crypto.subtle.digest polyfill only supports SHA-256, got ${name}`));
      }
      return ExpoCrypto.digest(ExpoCrypto.CryptoDigestAlgorithm.SHA256, data);
    },
  };
}
