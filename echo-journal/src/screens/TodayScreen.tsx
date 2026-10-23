import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Recorder } from '../components/Recorder';
import { Button, Card, EntryRow, SectionLabel, ui } from '../components/ui';
import { dailyPrompt, fallbackPrompt } from '../ai';
import { Entry, listEntries, weekStart } from '../db';
import { saveTextEntry, saveVoiceEntry } from '../pipeline';
import { FREE_ENTRIES_PER_WEEK, aiAllowed } from '../settings';
import { colors } from '../theme';

type Props = {
  isPro: boolean;
  refreshKey: number;
  syncing: boolean;
  onOpenEntry: (id: number) => void;
  onChanged: () => void;
  onOpenSettings: () => void;
};

export function TodayScreen({ isPro, refreshKey, syncing, onOpenEntry, onChanged, onOpenSettings }: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [prompt, setPrompt] = useState(fallbackPrompt());
  const [promptLoading, setPromptLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState('');

  const load = async () => setEntries(await listEntries());
  useEffect(() => { listEntries().then(setEntries); }, [refreshKey]);

  const thisWeek = entries.filter((e) => e.createdAt >= weekStart()).length;
  const atLimit = !isPro && thisWeek >= FREE_ENTRIES_PER_WEEK;

  // AI-personalized prompts are a Pro feature; free users get the rotating starter set.
  async function refreshPrompt() {
    if (!isPro || !aiAllowed()) {
      setPrompt(fallbackPrompt(Math.floor(Math.random() * 100)));
      return;
    }
    setPromptLoading(true);
    try {
      setPrompt(await dailyPrompt(entries));
    } catch {
      setPrompt(fallbackPrompt(Math.floor(Math.random() * 100)));
    } finally {
      setPromptLoading(false);
    }
  }

  const hasEntries = entries.length > 0;
  useEffect(() => {
    if (!isPro || !hasEntries || !aiAllowed()) return;
    let alive = true;
    dailyPrompt(entries).then((p) => alive && setPrompt(p)).catch(() => {});
    return () => { alive = false; };
    // Only on first load with data, not on every entry change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPro, hasEntries]);

  async function onRecorded(uri: string, durationSec: number) {
    setBusy(aiAllowed() ? 'Transcribing…' : 'Saving…');
    const res = await saveVoiceEntry({ tempUri: uri, durationSec, prompt });
    setBusy(null);
    await load();
    onChanged();
    if (res.error && aiAllowed()) {
      Alert.alert('Saved, not transcribed yet', `${res.error}\n\nYour recording is safe and will be transcribed automatically when you're back online.`);
    }
  }

  async function onSaveText() {
    if (!draft.trim()) return;
    await saveTextEntry(draft, prompt);
    setDraft('');
    setTyping(false);
    await load();
    onChanged();
  }

  const limitPress = () =>
    Alert.alert(
      'Weekly limit reached',
      `Free accounts get ${FREE_ENTRIES_PER_WEEK} entries a week. Upgrade for unlimited entries, personalized prompts and mood insights.`,
      [{ text: 'Not now' }, { text: 'See Pro', onPress: onOpenSettings }],
    );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={ui.muted}>
          {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </Text>
        <Text style={ui.h1}>How are you, really?</Text>

        <Card style={{ gap: 10, marginTop: 6 }}>
          <View style={styles.promptHead}>
            <SectionLabel>{isPro ? "Today's prompt · for you" : "Today's prompt"}</SectionLabel>
            <Pressable onPress={refreshPrompt} hitSlop={10}>
              <Text style={styles.link}>{promptLoading ? '…' : 'Another'}</Text>
            </Pressable>
          </View>
          <Text style={ui.h2}>{prompt}</Text>
        </Card>

        <View style={styles.recordArea}>
          {busy ? (
            <View style={styles.busy}>
              <ActivityIndicator color={colors.accent} />
              <Text style={ui.muted}>{busy}</Text>
            </View>
          ) : typing ? (
            <View style={{ width: '100%', gap: 10 }}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Write freely…"
                placeholderTextColor={colors.muted}
                multiline
                autoFocus
                style={styles.input}
              />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}><Button label="Cancel" kind="ghost" onPress={() => setTyping(false)} /></View>
                <View style={{ flex: 1 }}><Button label="Save entry" onPress={onSaveText} disabled={!draft.trim()} /></View>
              </View>
            </View>
          ) : (
            <>
              <Recorder disabled={atLimit} onDisabledPress={limitPress} onFinished={onRecorded} />
              <Pressable onPress={() => (atLimit ? limitPress() : setTyping(true))} hitSlop={8}>
                <Text style={styles.link}>or type instead</Text>
              </Pressable>
            </>
          )}
        </View>

        {!isPro && (
          <Text style={[ui.muted, { textAlign: 'center' }]}>
            {thisWeek} of {FREE_ENTRIES_PER_WEEK} free entries this week
          </Text>
        )}

        <View style={styles.entriesHead}>
          <SectionLabel>Recent entries</SectionLabel>
          {syncing && (
            <View style={styles.syncing}>
              <ActivityIndicator size="small" color={colors.muted} />
              <Text style={ui.rowMeta}>transcribing</Text>
            </View>
          )}
        </View>
        {entries.length === 0 ? (
          <Text style={ui.muted}>Your entries will show up here. Start with 30 seconds about your day.</Text>
        ) : (
          entries.slice(0, 20).map((e) => <EntryRow key={e.id} entry={e} onPress={() => onOpenEntry(e.id)} />)
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40, gap: 12 },
  promptHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { color: colors.accent, fontWeight: '600', fontSize: 14 },
  recordArea: { alignItems: 'center', paddingVertical: 12, gap: 6, minHeight: 210, justifyContent: 'center' },
  busy: { alignItems: 'center', gap: 10 },
  entriesHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  syncing: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  input: {
    minHeight: 140, backgroundColor: colors.card, borderRadius: 14, padding: 14, fontSize: 16,
    color: colors.ink, textAlignVertical: 'top', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line,
  },
});
