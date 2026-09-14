import React from "react";
import { View, Text, TouchableOpacity, Linking, Alert, StyleSheet, Animated, Platform } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useBottomBarScroll } from "../context/BottomBarContext";

const TABS = [
  { route: "/home", icon: "home-outline", iconActive: "home", label: "Home" },
  { route: "/announcements", icon: "megaphone-outline", iconActive: "megaphone", label: "Alerts" },
  { route: "/my-reports", icon: "document-text-outline", iconActive: "document-text", label: "Reports" },
  { route: "/profile", icon: "person-outline", iconActive: "person", label: "Profile" },
];

const HIDE_ON = ["/login", "/register"];

export function BottomBar() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { translateY } = useBottomBarScroll();

  if (HIDE_ON.some((p) => pathname === p)) return null;

  const handleCallPolice = async () => {
    const url = "tel:117";
    try {
      if (Platform.OS === "android") {
        await Linking.openURL(url);
        return;
      }
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
      else Alert.alert("Cannot place call", "Your device cannot make phone calls.");
    } catch (e) {
      Alert.alert("Cannot place call", "Your device cannot make phone calls.");
    }
  };

  return (
    <Animated.View
      style={[
        barStyles.container,
        {
          paddingBottom: 8 + insets.bottom,
          transform: [
            {
              translateY: translateY.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 120],
              }),
            },
          ],
        },
      ]}
    >
      <View pointerEvents="none" style={barStyles.centerRing} />
      {pathname === "/home" && (
        <View pointerEvents="none" style={barStyles.homeNoteWrap}>
          <View style={barStyles.homeNote}>
            <Ionicons name="wifi" size={10} color="#0b1e63" />
            <Text style={barStyles.homeNoteText}>No internet? Use phone call</Text>
          </View>
        </View>
      )}
      <TouchableOpacity style={barStyles.centerCircle} onPress={handleCallPolice} activeOpacity={0.7}>
        <Ionicons name="call" size={20} color="#F4B51A" />
        <Text style={barStyles.centerLabel}>PNP</Text>
      </TouchableOpacity>
      <View style={barStyles.row}>
        {TABS.slice(0, 2).map((tab) => {
          const active = pathname === tab.route;
          return (
            <TouchableOpacity
              key={tab.route}
              style={[barStyles.item, active && barStyles.itemActive]}
              onPress={() => router.replace(tab.route as any)}
            >
              <Ionicons
                name={(active ? tab.iconActive : tab.icon) as any}
                size={22}
                color={active ? "#F4B51A" : "rgba(255,255,255,0.55)"}
              />
              <Text style={[barStyles.label, active && barStyles.labelActive]} numberOfLines={1}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
        <View style={{ width: 56 }} />
        {TABS.slice(2).map((tab) => {
          const active = pathname === tab.route;
          return (
            <TouchableOpacity
              key={tab.route}
              style={[barStyles.item, active && barStyles.itemActive]}
              onPress={() => router.replace(tab.route as any)}
            >
              <Ionicons
                name={(active ? tab.iconActive : tab.icon) as any}
                size={22}
                color={active ? "#F4B51A" : "rgba(255,255,255,0.55)"}
              />
              <Text style={[barStyles.label, active && barStyles.labelActive]} numberOfLines={1}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </Animated.View>
  );
}

const barStyles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    backgroundColor: "#0b1e63",
    paddingTop: 14,
    paddingBottom: 2,
    shadowColor: "#0b1e63",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 20,
    zIndex: 100,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 8,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    borderRadius: 12,
  },
  itemActive: {
    backgroundColor: "rgba(244, 181, 26, 0.15)",
  },
  centerCircle: {
    position: "absolute",
    top: -28,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#12318c",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#F4B51A",
    shadowColor: "#0b1e63",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 12,
  },
  centerRing: {
    position: "absolute",
    top: -32,
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: "rgba(244, 181, 26, 0.35)",
    backgroundColor: "transparent",
  },
  centerLabel: {
    fontSize: 6,
    fontWeight: "800",
    color: "#F4B51A",
    marginTop: 2,
    letterSpacing: 0.5,
  },
  homeNoteWrap: {
    position: "absolute",
    top: -52,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 110,
  },
  homeNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(244, 181, 26, 0.95)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
  homeNoteText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#0b1e63",
  },
  label: {
    fontSize: 10,
    fontWeight: "600",
    color: "rgba(255,255,255,0.55)",
    marginTop: 3,
    textAlign: "center",
    overflow: "hidden",
  },
  labelActive: {
    color: "#F4B51A",
  },
});
