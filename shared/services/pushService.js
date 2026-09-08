import { Platform } from "react-native";
import { isRunningInExpoGo } from "expo";

let Notifications = null;
let handlerSet = false;

// expo-notifications throws during module evaluation on Android in Expo Go
// (SDK 53+ removed remote push there). Avoid importing it at all in that case.
function expoNotificationsUnavailable() {
  return Platform.OS === "android" && isRunningInExpoGo();
}

async function getNotifications() {
  if (expoNotificationsUnavailable()) {
    console.warn("expo-notifications skipped: unavailable in Expo Go on Android");
    return null;
  }
  if (!Notifications) {
    try {
      Notifications = await import("expo-notifications");
    } catch (e) {
      console.warn("expo-notifications not available:", e.message);
      return null;
    }
  }
  if (Notifications && !handlerSet) {
    try {
      if (typeof Notifications.setNotificationHandler === "function") {
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
          }),
        });
        handlerSet = true;
      }
    } catch (e) {
      console.warn("Could not set notification handler:", e.message);
    }
  }
  return Notifications;
}

// Remote push tokens (Expo Push) are unavailable in Expo Go since SDK 53.
export async function setupPushNotifications() {
  try {
    const N = await getNotifications();
    if (!N) return null;

    const { status: existing } = await N.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== "granted") {
      const { status } = await N.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return null;

    if (Platform.OS === "android") {
      await N.setNotificationChannelAsync("default", {
        name: "Default",
        importance: N.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#0F204B",
      });
    }

    try {
      const token = (await N.getExpoPushTokenAsync()).data;
      return token;
    } catch (e) {
      console.warn("Push token not available:", e.message);
      return null;
    }
  } catch (e) {
    console.warn("Push notification setup failed:", e.message);
    return null;
  }
}

export async function showLocalNotification(title, body, data = {}) {
  try {
    const N = await getNotifications();
    if (!N) return;
    await N.scheduleNotificationAsync({
      content: { title, body, data, sound: true },
      trigger: null,
    });
  } catch (e) {
    console.warn("Local notification failed:", e.message);
  }
}