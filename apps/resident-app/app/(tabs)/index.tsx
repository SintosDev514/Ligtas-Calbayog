import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Redirect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../../../../shared/supabase/supabaseClient";

const LOGIN_TIMESTAMP_KEY = "@ligtas_login_timestamp";
const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export default function Index() {
  const [isLoading, setIsLoading] = useState(true);
  const [route, setRoute] = useState<"login" | "home" | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          setRoute("login");
          return;
        }

        const { data: userData } = await supabase
          .from("users")
          .select("status")
          .eq("id", session.user.id)
          .maybeSingle();

        if (userData?.status === "banned" || userData?.status === "suspended") {
          await supabase.auth.signOut();
          await AsyncStorage.removeItem(LOGIN_TIMESTAMP_KEY);
          setRoute("login");
          return;
        }

        const timestampStr = await AsyncStorage.getItem(LOGIN_TIMESTAMP_KEY);

        if (!timestampStr) {
          const now = Date.now().toString();
          await AsyncStorage.setItem(LOGIN_TIMESTAMP_KEY, now);
          setRoute("home");
          return;
        }

        const loginTimestamp = parseInt(timestampStr, 10);
        const elapsed = Date.now() - loginTimestamp;

        if (elapsed >= ONE_MONTH_MS) {
          await supabase.auth.signOut();
          await AsyncStorage.removeItem(LOGIN_TIMESTAMP_KEY);
          setRoute("login");
          return;
        }

        setRoute("home");
      } catch {
        setRoute("login");
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  if (route === "home") return <Redirect href="/home" />;
  return <Redirect href="/login" />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: "#17202b",
    justifyContent: "center",
    alignItems: "center",
  },
});
