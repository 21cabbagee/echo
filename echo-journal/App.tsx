import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { initDb } from './src/db';
import { autoReflectLastWeek, processPending } from './src/pipeline';
import * as Notifications from 'expo-notifications';
import { configureNotifications } from './src/reminders';
import { useAuthDeepLinks, useSession } from './src/supabase';
import { AuthScreen } from './src/screens/AuthScreen';
import { ConsentScreen } from './src/screens/ConsentScreen';
import { setAiConsent, useSettings } from './src/settings';
import { colors } from './src/theme';
import { TodayScreen } from './src/screens/TodayScreen';
import { ReflectScreen } from './src/screens/ReflectScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { EntryScreen } from './src/screens/EntryScreen';

configureNotifications();

type Tab = 'today' | 'reflect' | 'settings';
const TABS: { id: Tab; label: string }[] = [
  { id: 'today', label: 'Journal' },
  { id: 'reflect', label: 'Reflect' },
  { id: 'settings', label: 'Settings' },
];

export default function App() {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>('today');
  const [openEntry, setOpenEntry] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);
  const settings = useSettings();
  const session = useSession();
  useAuthDeepLinks();

  // Tapping a reminder opens the screen it points at (including the tap that launched the app).
  useEffect(() => {
    const open = (r: Notifications.NotificationResponse | null) => {
      const screen = r?.notification.request.content.data?.screen;
      if (screen === 'reflect' || screen === 'today') {
        setOpenEntry(null);
        setTab(screen);
      }
    };
    Notifications.getLastNotificationResponseAsync().then(open);
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);
  const signedIn = !!session;
  const aiOn = settings.aiConsent === 'granted';

  useEffect(() => { initDb().then(() => setReady(true)); }, []);

  const bump = () => setRefreshKey((k) => k + 1);

  // Transcribe anything saved while offline: on launch and whenever the app comes back to the foreground.
  const sync = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      const { done } = await processPending();
      const reflected = await autoReflectLastWeek().catch(() => false);
      if (done || reflected) bump();
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    if (!ready || !signedIn || !aiOn) return;
    sync();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && sync());
    return () => sub.remove();
  }, [ready, signedIn, aiOn, sync]);

  const onSettingsChanged = () => { settings.reload(); bump(); };
  const goSettings = () => { setOpenEntry(null); setTab('settings'); };

  if (!ready || !settings.loaded || session === undefined) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!session) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <SafeAreaView style={styles.root}>
          <AuthScreen />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (settings.aiConsent === null) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <SafeAreaView style={styles.root}>
          <ConsentScreen
            onDecide={async (granted) => {
              await setAiConsent(granted ? 'granted' : 'declined');
              settings.reload();
            }}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={{ flex: 1 }}>
          {openEntry != null ? (
            <EntryScreen id={openEntry} onClose={() => setOpenEntry(null)} onChanged={bump} />
          ) : tab === 'today' ? (
            <TodayScreen
              isPro={settings.isPro}
              refreshKey={refreshKey}
              syncing={syncing}
              onOpenEntry={setOpenEntry}
              onChanged={bump}
              onOpenSettings={goSettings}
            />
          ) : tab === 'reflect' ? (
            <ReflectScreen isPro={settings.isPro} refreshKey={refreshKey} onUpgrade={goSettings} />
          ) : (
            <SettingsScreen
              email={session.user.email ?? ''}
              isPro={settings.isPro}
              aiOn={aiOn}
              onChanged={onSettingsChanged}
            />
          )}
        </View>
        {openEntry == null && (
          <View style={styles.tabBar}>
            {TABS.map((t) => (
              <Pressable key={t.id} onPress={() => setTab(t.id)} style={styles.tab} accessibilityRole="tab">
                <View style={[styles.tabDot, tab === t.id && { backgroundColor: colors.accent }]} />
                <Text style={[styles.tabText, tab === t.id && { color: colors.ink }]}>{t.label}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  tabBar: {
    flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line,
    backgroundColor: colors.bg, paddingTop: 10,
  },
  tab: { flex: 1, alignItems: 'center', gap: 5, paddingBottom: 4 },
  tabDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'transparent' },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.muted },
});
