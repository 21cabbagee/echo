import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';

// Local notifications only: nothing about the user's journal leaves the device.

export type ReminderTime = 'morning' | 'evening' | 'night';
export const REMINDER_TIMES: Record<ReminderTime, { label: string; hour: number; minute: number }> = {
  morning: { label: '8:00 am', hour: 8, minute: 0 },
  evening: { label: '8:00 pm', hour: 20, minute: 0 },
  night: { label: '10:00 pm', hour: 22, minute: 0 },
};

const KEY = 'reminder_time'; // ReminderTime, or 'off'

export async function getReminder(): Promise<ReminderTime | null> {
  const v = await SecureStore.getItemAsync(KEY);
  return v && v in REMINDER_TIMES ? (v as ReminderTime) : null;
}

/** Shows notifications as banners even while Echo is open. Call once at startup. */
export function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Turns reminders on at the given time (asking for permission first) or off with null.
 * Returns false if the user declined notification permission.
 */
export async function setReminder(time: ReminderTime | null): Promise<boolean> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!time) {
    await SecureStore.setItemAsync(KEY, 'off');
    return true;
  }

  const current = await Notifications.getPermissionsAsync();
  const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) {
    await SecureStore.setItemAsync(KEY, 'off');
    return false;
  }

  const { hour, minute } = REMINDER_TIMES[time];
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'A minute for Echo?',
      body: 'Tap to talk through your day. Thirty seconds is plenty.',
      data: { screen: 'today' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
  });
  // Monday morning (weekday 2; 1 is Sunday), when last week's reflection gets generated.
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Your weekly reflection',
      body: 'See the themes, wins and questions from last week.',
      data: { screen: 'reflect' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: 2, hour: 9, minute: 0 },
  });
  await SecureStore.setItemAsync(KEY, time);
  return true;
}
