import { Platform } from 'react-native';

export const colors = {
  bg: '#F7F3EE',
  card: '#FFFFFF',
  ink: '#2B2622',
  muted: '#8A8178',
  line: '#E8E1D8',
  accent: '#C8553D',
  accentSoft: '#F4DDD5',
  sage: '#7A9E7E',
  sageSoft: '#E1ECE2',
  danger: '#B3261E',
};

export const serif = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

export const moodColor = (m: number | null) =>
  m == null ? colors.line : ['#8C7AA9', '#A8A0C4', '#D9CFC2', '#E8B07A', '#E08A4F'][m + 2];

export function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function fmtDay(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function fmtTime(ms: number) {
  return new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
