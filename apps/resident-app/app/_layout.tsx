import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
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
              name="forgot-password"
              options={{ headerShown: false }}
            />
          </Stack>
          <StatusBar style="light" />
        </ThemeProvider>
      </MapStyleProvider>
    </LocationProvider>
  );
}
