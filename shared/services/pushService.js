import { Platform } from "react-native";

let Notifications = null;

async function getNotifications() {
  if (!Notifications) {
    Notifications = await import("expo-notifications");
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  }
  return Notifications;
}

export async function setupPushNotifications() {
  const N = await getNotifications();
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
}

export async function showLocalNotification(title, body, data = {}) {
  const N = await getNotifications();
  await N.scheduleNotificationAsync({
    content: { title, body, data, sound: true },
    trigger: null,
  });
}
