import { useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Button, Card, ui } from '../components/ui';
import { sendEmailLink, signInWithGoogle, supabaseConfigured, verifyEmailCode } from '../supabase';
import { colors, serif } from '../theme';

export function AuthScreen() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>, failTitle: string) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      Alert.alert(failTitle, (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const emailValid = /^\S+@\S+\.\S+$/.test(email.trim());

  const onSend = () =>
    run(async () => {
      await sendEmailLink(email);
      setSentTo(email.trim());
      setCode('');
    }, 'Couldn’t send the email');

  const onVerify = () => run(() => verifyEmailCode(sentTo!, code), 'That code didn’t work');

  const onGoogle = () => run(() => signInWithGoogle(), 'Google sign-in failed');

  if (!supabaseConfigured) {
    return (
      <View style={styles.wrap}>
        <Card style={{ gap: 8 }}>
          <Text style={ui.h2}>Sign-in isn’t set up yet</Text>
          <Text style={ui.muted}>
            Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart Expo.
          </Text>
        </Card>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>Echo</Text>
        <Text style={[ui.body, { textAlign: 'center', color: colors.muted }]}>
          Talk to your journal. Get a weekly mirror.
        </Text>

        <View style={{ height: 24 }} />

        {sentTo ? (
          <Card style={{ gap: 12 }}>
            <Text style={ui.h2}>Check your email</Text>
            <Text style={ui.body}>We sent a sign-in code to {sentTo}. Enter it below.</Text>
            <TextInput
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, ''))}
              placeholder="123456"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              maxLength={10}
              autoFocus
              style={[styles.input, styles.codeInput]}
            />
            <Button label={busy ? 'Checking…' : 'Sign in'} onPress={onVerify} disabled={busy || code.length < 6} />
            <Text style={ui.muted}>
              You can also tap the link in the email on this phone. Don’t see it? Check spam, or resend in a minute.
            </Text>
            <View style={styles.row}>
              <Pressable onPress={() => setSentTo(null)} hitSlop={8}>
                <Text style={styles.link}>Use a different email</Text>
              </Pressable>
              <Pressable onPress={onSend} hitSlop={8} disabled={busy}>
                <Text style={styles.link}>Resend email</Text>
              </Pressable>
            </View>
          </Card>
        ) : (
          <Card style={{ gap: 12 }}>
            <Pressable
              onPress={onGoogle}
              disabled={busy}
              style={({ pressed }) => [styles.google, (pressed || busy) && { opacity: 0.6 }]}
            >
              <Text style={styles.googleG}>G</Text>
              <Text style={styles.googleText}>Continue with Google</Text>
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={ui.rowMeta}>or</Text>
              <View style={styles.divider} />
            </View>

            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
              autoComplete="email"
              style={styles.input}
            />
            <Button label="Email me a sign-in code" onPress={onSend} disabled={busy || !emailValid} />
          </Card>
        )}

        {busy && <ActivityIndicator color={colors.accent} style={{ marginTop: 16 }} />}

        <Text style={[ui.rowMeta, { textAlign: 'center', marginTop: 24, lineHeight: 18 }]}>
          Your entries stay on this device. Your account is only used to unlock AI reflections.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 8 },
  brand: { fontFamily: serif, fontSize: 44, color: colors.ink, textAlign: 'center' },
  input: {
    borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 14, fontSize: 16,
    color: colors.ink, backgroundColor: colors.bg,
  },
  codeInput: { fontSize: 24, letterSpacing: 6, textAlign: 'center', fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  link: { color: colors.accent, fontWeight: '600', fontSize: 14 },
  google: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingVertical: 13, backgroundColor: '#fff',
  },
  googleG: { fontSize: 17, fontWeight: '700', color: '#4285F4' },
  googleText: { fontSize: 15, fontWeight: '600', color: colors.ink },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  divider: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
});
