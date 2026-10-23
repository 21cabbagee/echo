import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Button, Card, SectionLabel, ui } from '../components/ui';
import { Entry, deleteEntry, getEntry, updateEntry } from '../db';
import { processEntry } from '../pipeline';
import { colors, fmtDay, fmtDuration, fmtTime, moodColor } from '../theme';

type Props = { id: number; onClose: () => void; onChanged: () => void };

export function EntryScreen({ id, onClose, onChanged }: Props) {
  const [entry, setEntry] = useState<Entry | null>(null);
  const [text, setText] = useState('');
  const [working, setWorking] = useState(false);

  const apply = (e: Entry | null) => {
    setEntry(e);
    setText(e?.transcript ?? '');
  };
  const load = async () => apply(await getEntry(id));
  useEffect(() => { getEntry(id).then(apply); }, [id]);

  if (!entry) return null;
  const dirty = text !== entry.transcript;

  async function save() {
    await updateEntry(id, { transcript: text, mood: null, moodLabel: null });
    if (text.trim()) processEntry(id).catch(() => {}).finally(onChanged);
    await load();
    onChanged();
  }

  async function retry() {
    setWorking(true);
    try {
      await processEntry(id);
      await load();
      onChanged();
    } catch (e) {
      Alert.alert('Still not transcribed', (e as Error).message);
    } finally {
      setWorking(false);
    }
  }

  function confirmDelete() {
    Alert.alert('Delete this entry?', 'The recording and transcript are removed from this device permanently.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => { await deleteEntry(id); onChanged(); onClose(); },
      },
    ]);
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={12}><Text style={styles.link}>‹ Back</Text></Pressable>
        {dirty && <Pressable onPress={save} hitSlop={12}><Text style={styles.link}>Save</Text></Pressable>}
      </View>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={ui.muted}>{fmtDay(entry.createdAt)} · {fmtTime(entry.createdAt)}</Text>
        {entry.moodLabel && (
          <View style={styles.moodRow}>
            <View style={[styles.dot, { backgroundColor: moodColor(entry.mood) }]} />
            <Text style={ui.muted}>felt {entry.moodLabel}</Text>
          </View>
        )}
        {entry.prompt && (
          <Card style={{ backgroundColor: colors.bg }}>
            <SectionLabel>Prompt</SectionLabel>
            <Text style={[ui.body, { marginTop: 4 }]}>{entry.prompt}</Text>
          </Card>
        )}
        {entry.audioUri && <Player uri={entry.audioUri} durationSec={entry.durationSec} />}

        <SectionLabel>Transcript</SectionLabel>
        {!entry.transcript && entry.audioUri ? (
          working ? <ActivityIndicator color={colors.accent} /> : (
            <Card style={{ gap: 10 }}>
              <Text style={ui.muted}>This recording hasn’t been transcribed yet.</Text>
              <Button label="Transcribe now" onPress={retry} />
            </Card>
          )
        ) : (
          <TextInput value={text} onChangeText={setText} multiline style={styles.input} />
        )}

        <View style={{ height: 24 }} />
        <Button label="Delete entry" kind="danger" onPress={confirmDelete} />
      </ScrollView>
    </View>
  );
}

function Player({ uri, durationSec }: { uri: string; durationSec: number }) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

  function toggle() {
    if (status.playing) return player.pause();
    if (status.didJustFinish || status.currentTime >= status.duration - 0.1) player.seekTo(0);
    player.play();
  }

  const total = status.duration || durationSec;
  const pct = total ? Math.min(1, status.currentTime / total) : 0;
  return (
    <Card style={styles.player}>
      <Pressable onPress={toggle} style={styles.playBtn} accessibilityLabel={status.playing ? 'Pause' : 'Play'}>
        {status.playing ? (
          <View style={{ flexDirection: 'row', gap: 4 }}>
            <View style={styles.pauseBar} /><View style={styles.pauseBar} />
          </View>
        ) : (
          <View style={styles.playTri} />
        )}
      </Pressable>
      <View style={{ flex: 1, gap: 6 }}>
        <View style={styles.track}><View style={[styles.fill, { width: `${pct * 100}%` }]} /></View>
        <Text style={ui.rowMeta}>{fmtDuration(status.currentTime)} / {fmtDuration(total)}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  link: { color: colors.accent, fontWeight: '600', fontSize: 16 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
  moodRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  input: { fontSize: 17, lineHeight: 26, color: colors.ink, minHeight: 160, textAlignVertical: 'top' },
  player: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  playBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center',
  },
  playTri: {
    marginLeft: 4, width: 0, height: 0, borderTopWidth: 8, borderBottomWidth: 8, borderLeftWidth: 13,
    borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: '#fff',
  },
  pauseBar: { width: 4, height: 15, backgroundColor: '#fff', borderRadius: 1 },
  track: { height: 4, backgroundColor: colors.line, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, backgroundColor: colors.accent },
});
