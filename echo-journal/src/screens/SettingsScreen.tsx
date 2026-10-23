import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Bullets, Button, Card, SectionLabel, ui } from '../components/ui';
import { API_URL, checkHealth, deleteAccount } from '../ai';
import { deleteAllData } from '../db';
import { FREE_ENTRIES_PER_WEEK, PAYMENTS_ENABLED, setAiConsent, setIsPro } from '../settings';
import { REMINDER_TIMES, ReminderTime, getReminder, setReminder } from '../reminders';
import { signOut, signOutLocally } from '../supabase';
import { colors } from '../theme';

type Props = { email: string; isPro: boolean; aiOn: boolean; onChanged: () => void };

export function SettingsScreen({ email, isPro, aiOn, onChanged }: Props) {
  const [online, setOnline] = useState<boolean | null>(null);

  async function check() {
    setOnline(null);
    setOnline(await checkHealth());
  }
  useEffect(() => { checkHealth().then(setOnline); }, []);

  const [reminder, setReminderState] = useState<ReminderTime | null>(null);
  useEffect(() => { getReminder().then(setReminderState); }, []);

  async function chooseReminder(time: ReminderTime | null) {
    const ok = await setReminder(time);
    setReminderState(ok ? time : null);
    if (!ok) {
      Alert.alert('Notifications are off', 'Allow notifications for Expo Go (or Echo) in iOS Settings to get reminders.');
    }
  }

  function toggleAi(on: boolean) {
    if (!on) {
      setAiConsent('declined').then(onChanged);
      return;
    }
    Alert.alert(
      'Turn on AI features?',
      'Your recordings and entry text will be sent to Echo’s server and our AI provider, Groq, to transcribe and reflect. They aren’t stored on our server, sold, or used to train AI.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Allow', onPress: () => setAiConsent('granted').then(onChanged) },
      ],
    );
  }

  function confirmSignOut() {
    Alert.alert('Sign out?', 'Your entries stay on this device. AI features pause until you sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', onPress: () => signOut() },
    ]);
  }

  const [deleting, setDeleting] = useState(false);

  async function doDeleteAccount() {
    setDeleting(true);
    try {
      // Server first: if it fails, keep local data so nothing is lost by half.
      await deleteAccount();
      await deleteAllData();
      await signOutLocally();
    } catch (e) {
      Alert.alert('Couldn’t delete your account', `${(e as Error).message}\n\nNothing was deleted. Try again in a moment.`);
    } finally {
      setDeleting(false);
    }
  }

  function confirmDeleteAccount() {
    Alert.alert(
      'Delete your account?',
      'This permanently deletes your Echo account and erases every entry, recording and reflection on this device. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Are you sure?', `${email || 'Your account'} and all journal data will be gone for good.`, [
              { text: 'Keep my account', style: 'cancel' },
              { text: 'Delete forever', style: 'destructive', onPress: doDeleteAccount },
            ]),
        },
      ],
    );
  }

  function confirmWipe() {
    Alert.alert(
      'Delete everything?',
      'All entries, recordings and reflections are permanently erased from this device. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete all', style: 'destructive', onPress: async () => { await deleteAllData(); onChanged(); } },
      ],
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={ui.h1}>Settings</Text>

      <SectionLabel>Account</SectionLabel>
      <Card style={{ gap: 12 }}>
        <Text style={ui.body}>{email || 'Signed in'}</Text>
        <Button label="Sign out" kind="ghost" onPress={confirmSignOut} />
        <Button
          label={deleting ? 'Deleting…' : 'Delete account'}
          kind="danger"
          onPress={confirmDeleteAccount}
          disabled={deleting}
        />
      </Card>

      <SectionLabel>Reminders</SectionLabel>
      <Card style={{ gap: 12 }}>
        <View style={styles.row}>
          <Text style={[ui.body, { flex: 1 }]}>Daily nudge to journal</Text>
          <Switch
            value={reminder != null}
            onValueChange={(v) => chooseReminder(v ? 'evening' : null)}
            trackColor={{ true: colors.accent }}
          />
        </View>
        {reminder != null && (
          <View style={styles.chips}>
            {(Object.keys(REMINDER_TIMES) as ReminderTime[]).map((t) => (
              <Pressable
                key={t}
                onPress={() => chooseReminder(t)}
                style={[styles.chip, reminder === t && styles.chipOn]}
              >
                <Text style={[styles.chipText, reminder === t && { color: '#fff' }]}>{REMINDER_TIMES[t].label}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <Text style={ui.muted}>Includes a Monday-morning note when your weekly reflection is ready.</Text>
      </Card>

      <SectionLabel>AI</SectionLabel>
      <Card style={{ gap: 6 }}>
        <View style={styles.row}>
          <Text style={[ui.body, { flex: 1 }]}>AI transcription & reflections</Text>
          <Switch value={aiOn} onValueChange={toggleAi} trackColor={{ true: colors.accent }} />
        </View>
        <Text style={[ui.muted, { marginBottom: 6 }]}>
          {aiOn
            ? 'Recordings and text are sent to our AI provider (Groq) only to run these features.'
            : 'Off: entries are saved on this phone only, without transcripts or reflections.'}
        </Text>
        <Pressable onPress={check} style={styles.row} hitSlop={6}>
          <View
            style={[
              styles.dot,
              { backgroundColor: online == null ? colors.line : online ? colors.sage : colors.danger },
            ]}
          />
          <Text style={[ui.body, { flex: 1 }]}>
            {online == null ? 'Checking…' : online ? 'Connected' : "Can't reach the AI server"}
          </Text>
          <Text style={styles.link}>Check</Text>
        </Pressable>
        <Text style={ui.rowMeta}>{API_URL || 'No server configured'}</Text>
        {online === false && (
          <Text style={ui.muted}>
            Recordings still save. They’ll be transcribed automatically once the server is reachable.
          </Text>
        )}
      </Card>

      {PAYMENTS_ENABLED && (
        <>
          <SectionLabel>Plan</SectionLabel>
          <Card style={{ gap: 12 }}>
            <Text style={ui.h2}>{isPro ? 'Echo Pro' : 'Free'}</Text>
            <Bullets
              items={[
                `Free: ${FREE_ENTRIES_PER_WEEK} entries a week and a weekly reflection`,
                'Pro ($7/mo): unlimited entries, personalized daily prompts, mood trends',
              ]}
            />
            {/* Until real payments are wired up, Pro can only be toggled in development builds. */}
            {__DEV__ && (
              <View style={styles.row}>
                <Text style={[ui.body, { flex: 1 }]}>Simulate Pro (dev only)</Text>
                <Switch
                  value={isPro}
                  onValueChange={async (v) => { await setIsPro(v); onChanged(); }}
                  trackColor={{ true: colors.accent }}
                />
              </View>
            )}
          </Card>
        </>
      )}

      <SectionLabel>Your data</SectionLabel>
      <Card style={{ gap: 12 }}>
        <Bullets
          items={[
            'Entries and recordings are stored only on this device.',
            'Audio and text are sent over HTTPS only to transcribe and reflect, and are not stored on our server. Nothing is sold or shared.',
            "Echo never diagnoses. Insights are patterns you might explore. If you're struggling, talk to someone you trust or a local crisis line.",
          ]}
        />
        <Pressable onPress={() => WebBrowser.openBrowserAsync(`${API_URL}/privacy`)} hitSlop={6}>
          <Text style={styles.link}>Read the privacy policy</Text>
        </Pressable>
        <Button label="Delete all my data" kind="danger" onPress={confirmWipe} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  link: { color: colors.accent, fontWeight: '600', fontSize: 14 },
  chips: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.line,
  },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.ink },
});
