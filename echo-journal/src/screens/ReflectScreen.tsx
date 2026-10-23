import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Bullets, Button, Card, SectionLabel, ui } from '../components/ui';
import { weeklyReflection } from '../ai';
import { Entry, Reflection, listEntries, listReflections, saveReflection, weekStart } from '../db';
import { MIN_ENTRIES_FOR_REFLECTION } from '../pipeline';
import { colors, moodColor } from '../theme';

type Props = { isPro: boolean; refreshKey: number; onUpgrade: () => void };

const MIN_ENTRIES = MIN_ENTRIES_FOR_REFLECTION;
const DAY = 86_400_000;

export function ReflectScreen({ isPro, refreshKey, onUpgrade }: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = () => Promise.all([listEntries(Date.now() - 28 * DAY), listReflections()]);
  const apply = ([e, r]: [Entry[], Reflection[]]) => {
    setEntries(e);
    setReflections(r);
  };
  const load = async () => apply(await fetchAll());
  useEffect(() => { fetchAll().then(apply); }, [refreshKey]);

  const ws = weekStart();
  const weekEntries = entries.filter((e) => e.createdAt >= ws && e.transcript);
  const current = reflections.find((r) => r.weekStart === ws);
  const past = reflections.filter((r) => r.weekStart !== ws);

  async function generate() {
    setLoading(true);
    try {
      const r = await weeklyReflection(weekEntries);
      await saveReflection({ ...r, weekStart: ws, createdAt: Date.now(), entryCount: weekEntries.length });
      await load();
    } catch (e) {
      Alert.alert('Could not reflect', (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const canGenerate = weekEntries.length >= MIN_ENTRIES;
  const stale = current && current.entryCount < weekEntries.length;

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={ui.h1}>Reflections</Text>
      <Text style={ui.muted}>
        Patterns you might explore. These aren’t diagnoses, just a mirror held up to what you said.
      </Text>

      <SectionLabel>This week</SectionLabel>
      {current ? (
        <ReflectionCard r={current} />
      ) : (
        <Card style={{ gap: 8 }}>
          <Text style={ui.h2}>
            {weekEntries.length >= MIN_ENTRIES
              ? 'Ready when you are.'
              : `${weekEntries.length} of ${MIN_ENTRIES} entries`}
          </Text>
          <Text style={ui.muted}>
            {weekEntries.length >= MIN_ENTRIES
              ? 'You have enough entries for a reflection on themes, wins and tensions.'
              : `Record ${MIN_ENTRIES - weekEntries.length} more this week to unlock your reflection.`}
          </Text>
        </Card>
      )}
      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginVertical: 12 }} />
      ) : (
        (!current || stale) && (
          <Button
            label={current ? `Update with ${weekEntries.length - current.entryCount} new entries` : 'Reflect on my week'}
            onPress={generate}
            disabled={!canGenerate}
          />
        )
      )}

      <SectionLabel>Mood over 4 weeks</SectionLabel>
      {isPro ? (
        <MoodTrend entries={entries} />
      ) : (
        <Card style={{ gap: 10 }}>
          <Text style={ui.body}>See how your days have felt over time. Mood trends are part of Pro.</Text>
          <Button label="See Pro" kind="ghost" onPress={onUpgrade} />
        </Card>
      )}

      {past.length > 0 && <SectionLabel>Earlier weeks</SectionLabel>}
      {past.map((r) => <ReflectionCard key={r.id} r={r} />)}
    </ScrollView>
  );
}

function ReflectionCard({ r }: { r: Reflection }) {
  const end = new Date(r.weekStart + 6 * DAY);
  const range = `${new Date(r.weekStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  return (
    <Card style={{ gap: 14 }}>
      <Text style={ui.muted}>{range} · {r.entryCount} entries</Text>
      <Text style={ui.h2}>{r.summary}</Text>
      {r.themes.length > 0 && (
        <View style={styles.chips}>
          {r.themes.map((t, i) => <Text key={i} style={styles.chip}>{t}</Text>)}
        </View>
      )}
      {r.wins.length > 0 && (
        <View style={{ gap: 6 }}>
          <SectionLabel>Wins</SectionLabel>
          <Bullets items={r.wins} color={colors.sage} />
        </View>
      )}
      {r.tensions.length > 0 && (
        <View style={{ gap: 6 }}>
          <SectionLabel>Tensions</SectionLabel>
          <Bullets items={r.tensions} color={colors.accent} />
        </View>
      )}
      {r.questions.length > 0 && (
        <View style={{ gap: 6 }}>
          <SectionLabel>To explore next</SectionLabel>
          <Bullets items={r.questions} color={colors.muted} />
        </View>
      )}
    </Card>
  );
}

function MoodTrend({ entries }: { entries: Entry[] }) {
  // Average mood per day for the last 28 days; empty days render as a faint stub.
  const days = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: 28 }, (_, i) => {
      const from = start.getTime() - (27 - i) * DAY;
      const scored = entries.filter((e) => e.mood != null && e.createdAt >= from && e.createdAt < from + DAY);
      const avg = scored.length ? scored.reduce((s, e) => s + (e.mood as number), 0) / scored.length : null;
      return { from, avg };
    });
  }, [entries]);

  const scored = days.filter((d) => d.avg != null);
  const labels = entries.filter((e) => e.moodLabel).slice(0, 40).map((e) => e.moodLabel as string);
  const top = Object.entries(labels.reduce<Record<string, number>>((m, l) => ((m[l] = (m[l] ?? 0) + 1), m), {}))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([l]) => l);

  const H = 90;
  return (
    <Card style={{ gap: 12 }}>
      {scored.length === 0 ? (
        <Text style={ui.muted}>Mood appears here once a few entries are transcribed.</Text>
      ) : (
        <>
          <View style={[styles.chart, { height: H }]}>
            <View style={[styles.midline, { top: H / 2 }]} />
            {days.map((d) => {
              const h = d.avg == null ? 3 : 6 + ((d.avg + 2) / 4) * (H - 6);
              return (
                <View key={d.from} style={styles.barSlot}>
                  <View
                    style={{
                      height: h, borderRadius: 3,
                      backgroundColor: d.avg == null ? colors.line : moodColor(Math.round(d.avg)),
                    }}
                  />
                </View>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={ui.rowMeta}>4 weeks ago</Text>
            <Text style={ui.rowMeta}>today</Text>
          </View>
          {top.length > 0 && <Text style={ui.muted}>Words that came up most: {top.join(', ')}</Text>}
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40, gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: colors.sageSoft, color: colors.ink, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999, fontSize: 13, overflow: 'hidden',
  },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  barSlot: { flex: 1, justifyContent: 'flex-end' },
  midline: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
});
