import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "../context/AuthContext";
import { AlarmProvider } from "../context/AlarmContext";
import ErrorBoundary from "../components/ErrorBoundary";

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AlarmProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="signup" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="resident/[id]" />
            <Stack.Screen name="navigate/[id]" />
            <Stack.Screen name="report/[id]" />
          </Stack>
        </AlarmProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
