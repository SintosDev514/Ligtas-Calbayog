import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

const CRIME_CATEGORIES = [
  { id: "hit-and-run", label: "Hit & Run", icon: "car-sport-outline", color: "#EF4444" },
  { id: "robbery", label: "Robbery", icon: "shield-outline", color: "#F59E0B" },
  { id: "theft", label: "Theft", icon: "bag-remove-outline", color: "#8B5CF6" },
  { id: "assault", label: "Assault", icon: "warning-outline", color: "#EC4899" },
  { id: "vandalism", label: "Vandalism", icon: "hammer-outline", color: "#06B6D4" },
  { id: "burglary", label: "Burglary", icon: "home-outline", color: "#10B981" },
  { id: "others", label: "Others", icon: "ellipsis-horizontal-outline", color: "#64748B" },
];

export default function ReportPickerScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F1F5F9" />
      <SafeAreaView edges={["top"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#0F204B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Report an Incident</Text>
          <View style={{ width: 38 }} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>What type of incident would you like to report?</Text>

        <View style={styles.grid}>
          {CRIME_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={styles.card}
              activeOpacity={0.8}
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/report",
                  params: { crimeType: cat.id, crimeLabel: cat.label },
                })
              }
            >
              <View style={[styles.iconWrap, { backgroundColor: cat.color + "15" }]}>
                <Ionicons name={cat.icon as any} size={28} color={cat.color} />
              </View>
              <Text style={styles.cardLabel}>{cat.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },
  header: { backgroundColor: "#F1F5F9" },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    backgroundColor: "#E2E8F0",
    borderRadius: 20,
    padding: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F204B",
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  subtitle: {
    fontSize: 15,
    color: "#64748B",
    marginBottom: 20,
    textAlign: "center",
    lineHeight: 22,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  card: {
    width: "47%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#17202b",
    textAlign: "center",
  },
});
