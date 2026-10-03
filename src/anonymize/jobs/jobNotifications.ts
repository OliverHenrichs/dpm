import * as Notifications from "expo-notifications";

/**
 * The phone notification that says video jobs finished while the app was in the background.
 * There is only ever one: a later batch replaces it, and coming back to the app removes it,
 * since the jobs banner says the same thing there.
 *
 * Every call is best-effort. A refused permission, or a platform without notifications, just
 * means no notification; the results still wait in the app for review.
 */

const CHANNEL_ID = "video-jobs";
const NOTIFICATION_ID = "video-jobs-finished";

/** Asked once per app run at most; a refusal is the user's answer until they change it. */
let asked = false;

/**
 * Asks for the notification permission when it has not been decided yet. Called when the user
 * starts a job, so the system prompt comes with the action it is for. On Android 13+ the
 * channel has to exist before the prompt can show, so it is created first.
 */
export async function askNotificationPermission(
  channelName: string,
): Promise<void> {
  if (asked) return;
  asked = true;
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: channelName,
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    const current = await Notifications.getPermissionsAsync();
    if (current.granted || !current.canAskAgain) return;
    await Notifications.requestPermissionsAsync();
  } catch {
    // No notifications here (web, or the module is missing); the banner is enough.
  }
}

export async function notifyJobsFinished(
  title: string,
  body: string,
): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_ID,
      content: { title, body },
      trigger: { channelId: CHANNEL_ID },
    });
  } catch {
    // See askNotificationPermission.
  }
}

export async function clearJobsNotification(): Promise<void> {
  try {
    await Notifications.dismissNotificationAsync(NOTIFICATION_ID);
  } catch {
    // Nothing to clear.
  }
}

/** Calls `onOpen` when the user taps the notification; returns the unsubscribe. */
export function onJobsNotificationOpened(onOpen: () => void): () => void {
  try {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        if (response.notification.request.identifier === NOTIFICATION_ID) {
          onOpen();
        }
      },
    );
    return () => subscription.remove();
  } catch {
    return () => undefined;
  }
}

/** For tests: forget that the permission was asked for. */
export function resetNotificationPermissionAsked() {
  asked = false;
}
