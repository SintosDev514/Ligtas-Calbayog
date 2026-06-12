import React, { useRef } from "react";
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, usePathname } from "expo-router";

type TabItem = {
  route: string;
  icon: string;
  iconActive: string;
  label: string;
};

const TABS: TabItem[] = [
  {
    route: "/(tabs)/home",
    icon: "home-outline",
    iconActive: "home",
    label: "Home",
  },
  {
    route: "/(tabs)/announcements",
    icon: "megaphone-outline",
    iconActive: "megaphone",
    label: "Alerts",
  },
  {
    route: "/(tabs)/my-reports",
    icon: "document-text-outline",
    iconActive: "document-text",
    label: "Reports",
  },
  {
    route: "/(tabs)/profile",
    icon: "person-outline",
    iconActive: "person",
    label: "Profile",
  },
];

export function BottomTabBar() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View style={styles.container}>
      <View style={styles.bar}>
        {TABS.map((tab) => {
          const isActive =
            pathname === tab.route ||
            pathname.startsWith(tab.route.replace("/(tabs)", ""));
          return (
            <TabButton
              key={tab.route}
              tab={tab}
              isActive={isActive}
              onPress={() => router.replace(tab.route as any)}
            />
          );
        })}
      </View>
    </View>
  );
}

function TabButton({
  tab,
  isActive,
  onPress,
}: {
  tab: TabItem;
  isActive: boolean;
  onPress: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.85, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 30 }),
    ]).start();
    onPress();
  };

  return (
    <TouchableOpacity
      style={styles.tab}
      onPress={handlePress}
      activeOpacity={1}
    >
      <Animated.View
        style={[
          styles.tabInner,
          isActive && styles.tabInnerActive,
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        <Ionicons
          name={(isActive ? tab.iconActive : tab.icon) as any}
          size={22}
          color={isActive ? "#fff" : "#94A3B8"}
        />
        <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
          {tab.label}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: Platform.OS === "ios" ? 24 : 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: "transparent",
  },
  bar: {
    flexDirection: "row",
    backgroundColor: "#0F204B",
    borderRadius: 28,
    paddingVertical: 8,
    paddingHorizontal: 8,
    elevation: 20,
    shadowColor: "#0F204B",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
  },
  tab: {
    flex: 1,
    alignItems: "center",
  },
  tabInner: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    gap: 3,
  },
  tabInnerActive: {
    backgroundColor: "#F4B51A",
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#94A3B8",
    letterSpacing: 0.3,
  },
  tabLabelActive: {
    color: "#fff",
  },
});
