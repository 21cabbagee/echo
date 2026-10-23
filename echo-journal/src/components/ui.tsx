import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import type { Entry } from '../db';
import { colors, fmtDay, fmtDuration, fmtTime, moodColor, serif } from '../theme';

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[ui.card, style]}>{children}</View>;
}

export function Button({
  label, onPress, kind = 'primary', disabled,
}: { label: string; onPress: () => void; kind?: 'primary' | 'ghost' | 'danger'; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        ui.btn,
        kind === 'primary' && { backgroundColor: colors.ink },
        kind === 'ghost' && { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line },
        kind === 'danger' && { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.danger },
        (pressed || disabled) && { opacity: 0.6 },
      ]}
    >
      <Text
        style={[
          ui.btnText,
          kind === 'ghost' && { color: colors.ink },
          kind === 'danger' && { color: colors.danger },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <Text style={ui.section}>{children}</Text>;
}

export function EntryRow({ entry, onPress }: { entry: Entry; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [ui.row, pressed && { opacity: 0.7 }]}>
      <View style={[ui.moodDot, { backgroundColor: moodColor(entry.mood) }]} />
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={ui.rowMeta}>
            {fmtDay(entry.createdAt)} · {fmtTime(entry.createdAt)}
          </Text>
          {entry.durationSec > 0 && <Text style={ui.rowMeta}>{fmtDuration(entry.durationSec)}</Text>}
        </View>
        <Text style={ui.rowText} numberOfLines={2}>
          {entry.transcript || 'Not transcribed yet. Tap to retry.'}
        </Text>
        {entry.moodLabel ? <Text style={ui.moodLabel}>{entry.moodLabel}</Text> : null}
      </View>
    </Pressable>
  );
}

export function Bullets({ items, color = colors.ink }: { items: string[]; color?: string }) {
  return (
    <View style={{ gap: 6 }}>
      {items.map((t, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
          <Text style={{ color }}>•</Text>
          <Text style={[ui.body, { flex: 1 }]}>{t}</Text>
        </View>
      ))}
    </View>
  );
}

export const ui = StyleSheet.create({
  card: {
    backgroundColor: colors.card, borderRadius: 18, padding: 18,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line,
  },
  btn: { paddingVertical: 13, paddingHorizontal: 18, borderRadius: 999, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  section: {
    fontSize: 12, fontWeight: '700', letterSpacing: 1.2, color: colors.muted,
    textTransform: 'uppercase', marginTop: 8,
  },
  h1: { fontFamily: serif, fontSize: 30, color: colors.ink },
  h2: { fontFamily: serif, fontSize: 21, color: colors.ink, lineHeight: 28 },
  body: { fontSize: 16, lineHeight: 23, color: colors.ink },
  muted: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  row: {
    flexDirection: 'row', gap: 12, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line,
  },
  moodDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  rowMeta: { fontSize: 12, color: colors.muted, fontVariant: ['tabular-nums'] },
  rowText: { fontSize: 15, lineHeight: 21, color: colors.ink },
  moodLabel: { fontSize: 12, color: colors.muted, fontStyle: 'italic' },
});
