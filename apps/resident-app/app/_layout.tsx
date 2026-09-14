import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "expo-router";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { LocationProvider } from "@/context/LocationContext";
import { MapStyleProvider } from "@/context/MapStyleContext";
import { NotificationsProvider, useNotifications } from "@/context/NotificationsContext";
import { useAutoLogout } from "../hooks/useAutoLogout";
import NotificationPopup from "../components/NotificationPopup";
import { MapTileWarmer } from "../components/MapTileWarmer";
import { NotificationsSheet } from "../components/NotificationsSheet";

export const unstable_settings = {
  anchor: "(tabs)",
};

function NotificationHost() {
  const { visible, close, setUnreadCount } = useNotifications();
  return (
    <>
      <NotificationPopup />
      <NotificationsSheet
        visible={visible}
        onClose={close}
        onUnreadChange={setUnreadCount}
      />
    </>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  useAutoLogout();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <LocationProvider>
        <MapStyleProvider>
          <NotificationsProvider>
            <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
              <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen
                  name="modal"
                  options={{ presentation: "modal", title: "Modal" }}
                />
                <Stack.Screen
                  name="fullscreen-map"
                  options={{ headerShown: false, animation: "slide_from_bottom" }}
                />
                <Stack.Screen
                  name="forgot-password"
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="report-detail"
                  options={{ headerShown: false, animation: "slide_from_right" }}
                />
              </Stack>
              <StatusBar style="light" />
              <NotificationHost />
              <MapTileWarmer />
            </ThemeProvider>
          </NotificationsProvider>
        </MapStyleProvider>
      </LocationProvider>
    </GestureHandlerRootView>
  );
}
