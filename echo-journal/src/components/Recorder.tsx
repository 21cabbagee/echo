import { useEffect, useRef } from 'react';
import { Alert, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { colors, fmtDuration } from '../theme';

type Props = {
  disabled?: boolean;
  onDisabledPress?: () => void;
  onFinished: (uri: string, durationSec: number) => void;
};

const MAX_SEC = 10 * 60;

export function Recorder({ disabled, onDisabledPress, onFinished }: Props) {
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const state = useAudioRecorderState(recorder, 100);
  const pulse = useRef(new Animated.Value(1)).current;

  const sec = state.durationMillis / 1000;

  // Ring grows with input level so the user can see the mic is hearing them.
  useEffect(() => {
    if (!state.isRecording) {
      Animated.timing(pulse, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      return;
    }
    const db = state.metering ?? -60;
    const level = Math.max(0, Math.min(1, (db + 60) / 60));
    Animated.timing(pulse, { toValue: 1 + level * 0.45, duration: 100, useNativeDriver: true }).start();
  }, [state.metering, state.isRecording, pulse]);

  useEffect(() => {
    if (state.isRecording && sec >= MAX_SEC) stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sec, state.isRecording]);

  async function start() {
    if (disabled) return onDisabledPress?.();
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Microphone needed', 'Allow microphone access in Settings to record entries.');
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
  }

  async function stop() {
    const duration = recorder.currentTime || sec;
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    if (recorder.uri && duration >= 1) onFinished(recorder.uri, Math.round(duration));
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.btnWrap}>
        <Animated.View style={[styles.ring, { transform: [{ scale: pulse }], opacity: state.isRecording ? 1 : 0 }]} />
        <Pressable
          onPress={state.isRecording ? stop : start}
          style={({ pressed }) => [styles.btn, disabled && styles.btnDisabled, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel={state.isRecording ? 'Stop recording' : 'Start recording'}
        >
          {state.isRecording ? <View style={styles.stopIcon} /> : <View style={styles.micDot} />}
        </Pressable>
      </View>
      <Text style={styles.caption}>
        {state.isRecording ? fmtDuration(sec) : 'Tap to talk'}
      </Text>
    </View>
  );
}

const SIZE = 96;

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 14 },
  btnWrap: { width: SIZE * 1.6, height: SIZE * 1.6, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute', width: SIZE * 1.15, height: SIZE * 1.15, borderRadius: SIZE,
    backgroundColor: colors.accentSoft,
  },
  btn: {
    width: SIZE, height: SIZE, borderRadius: SIZE / 2, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.accent, shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
  },
  btnDisabled: { backgroundColor: colors.muted, shadowOpacity: 0 },
  micDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff' },
  stopIcon: { width: 28, height: 28, borderRadius: 6, backgroundColor: '#fff' },
  caption: { color: colors.muted, fontSize: 15, fontVariant: ['tabular-nums'] },
});
