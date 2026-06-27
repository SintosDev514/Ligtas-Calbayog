import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { LocationProvider } from "@/context/LocationContext";
import { MapStyleProvider } from "@/context/MapStyleContext";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <LocationProvider>
        <MapStyleProvider>
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
                name="emergency-report"
                options={{ headerShown: false, animation: "slide_from_bottom" }}
              />
            </Stack>
            <StatusBar style="light" />
          </ThemeProvider>
        </MapStyleProvider>
      </LocationProvider>
    </GestureHandlerRootView>
  );
}
