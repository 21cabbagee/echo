import * as WebBrowser from 'expo-web-browser';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { API_URL } from '../ai';
import { Bullets, Button, Card, ui } from '../components/ui';
import { colors, serif } from '../theme';

type Props = { onDecide: (granted: boolean) => void };

/**
 * One-time disclosure before any data goes to the third-party AI provider
 * (Apple App Review guideline 5.1.2(i); Google Play prominent-disclosure rules).
 */
export function ConsentScreen({ onDecide }: Props) {
  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.title}>Before Echo listens</Text>
      <Text style={[ui.body, { color: colors.muted }]}>
        Echo uses an AI service to turn your voice into text and reflect on your week. Here’s exactly what that means.
      </Text>

      <Card style={{ gap: 10 }}>
        <Text style={ui.h2}>What gets shared</Text>
        <Bullets
          items={[
            'Your recordings and entry text are sent over an encrypted connection to Echo’s server, which passes them to our AI provider, Groq, to transcribe, score mood, write reflections and suggest prompts.',
            'Only when one of those features runs. Echo’s server doesn’t store your recordings or journal text.',
          ]}
        />
      </Card>

      <Card style={{ gap: 10 }}>
        <Text style={ui.h2}>What never happens</Text>
        <Bullets
          items={[
            'We don’t sell your data or share it with advertisers.',
            'We don’t use your journal to train AI models.',
            'Insights are patterns to explore, never diagnoses.',
          ]}
          color={colors.sage}
        />
      </Card>

      <Text style={[ui.muted, styles.center]}>
        Your entries are always saved on this phone. You can change this anytime in Settings.
      </Text>
      <Text
        style={[styles.link, styles.center]}
        onPress={() => WebBrowser.openBrowserAsync(`${API_URL}/privacy`)}
        accessibilityRole="link"
      >
        Read the privacy policy
      </Text>

      <View style={{ gap: 10, marginTop: 8 }}>
        <Button label="Allow AI features" onPress={() => onDecide(true)} />
        <Button label="Continue without AI" kind="ghost" onPress={() => onDecide(false)} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 24, gap: 14, flexGrow: 1, justifyContent: 'center' },
  title: { fontFamily: serif, fontSize: 32, color: colors.ink },
  center: { textAlign: 'center' },
  link: { color: colors.accent, fontWeight: '600', fontSize: 14 },
});
