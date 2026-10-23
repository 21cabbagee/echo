import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useState } from 'react';

const KEY_PRO = 'is_pro';

export const FREE_ENTRIES_PER_WEEK = 7;

export async function getIsPro() {
  return (await SecureStore.getItemAsync(KEY_PRO)) === '1';
}

export async function setIsPro(v: boolean) {
  await SecureStore.setItemAsync(KEY_PRO, v ? '1' : '0');
}

export function useSettings() {
  const [isPro, setPro] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    setPro(await getIsPro());
    setLoaded(true);
  }, []);

  useEffect(() => {
    getIsPro().then((p) => {
      setPro(p);
      setLoaded(true);
    });
  }, []);

  return { isPro, loaded, reload };
}
