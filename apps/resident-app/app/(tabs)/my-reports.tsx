import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Animated,
  StatusBar,
  ScrollView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useBottomBarScroll } from "../../context/BottomBarContext";
import { supabase } from "../../../../shared/supabase/supabaseClient";
import { fetchResidentReports } from "../../../../shared/services/reportService";
import {
  STATUS_META,
  CRIME_ICONS,
  CRIME_COLORS,
  FILTERS,
  formatDate,
  getTimeAgo,
} from "../../constants/reportMeta";

export default function MyReportsScreen() {
  const router = useRouter();
  const { onScroll } = useBottomBarScroll();
  const params = useLocalSearchParams();
  const [reports, setReports] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selectedFilter, setSelectedFilter] = useState((params.filter as string) || "all");

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError("");
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      if (!userId) { setError("Not logged in. Please sign in to view your reports."); return; }
      const data = await fetchResidentReports(userId);
      setReports(data);
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: false }).start();
    } catch (e: any) {
      setError(e.message || "Failed to load reports.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    const status = item.status?.toLowerCase() || "pending";
    const statusMeta = STATUS_META[status] ?? STATUS_META["pending"];
    const crimeIcon = CRIME_ICONS[item.crime_type] ?? "alert-circle";
    const crimeColor = CRIME_COLORS[item.crime_type] ?? "#64748B";
    const crimeLabel = item.crime_type
      ? item.crime_type.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
      : "Unknown Incident";

    return (
      <Animated.View
        style={[
          styles.cardContainer,
          {
            opacity: fadeAnim,
            transform: [{
              translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [30 + index * 10, 0],
              }),
            }],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.cardShadow}
          activeOpacity={0.9}
          onPress={() => router.push({ pathname: "/report-detail", params: { id: item.id } } as any)}
        >
          <View style={styles.card}>
            <View style={styles.cardInner}>
              <View style={styles.cardHeader}>
                <View style={[styles.crimeIconCircle, { backgroundColor: crimeColor + "1A" }]}>
                  <Ionicons name={crimeIcon as any} size={22} color={crimeColor} />
                </View>

                <View style={styles.headerContent}>
                  <Text style={styles.crimeType} numberOfLines={1}>{crimeLabel}</Text>
                  <View style={styles.headerMeta}>
                    <Ionicons name="calendar-outline" size={11} color="#94A3B8" />
                    <Text style={styles.reportDate} numberOfLines={1} ellipsizeMode="tail">{formatDate(item.created_at)}</Text>
                    <Text style={styles.headerDot}>{"\u2022"}</Text>
                    <Text style={styles.reportDate} numberOfLines={1} ellipsizeMode="tail">{getTimeAgo(item.created_at)}</Text>
                  </View>
                </View>

                <View style={[styles.statusBadge, { backgroundColor: statusMeta.bg, borderColor: statusMeta.text + "2E" }]}>
                  {status === "in-progress" && <View style={styles.statusLiveDot} />}
                  <Ionicons name={statusMeta.icon as any} size={11} color={statusMeta.text} />
                  <Text style={[styles.statusText, { color: statusMeta.text }]}>{statusMeta.label}</Text>
                </View>
              </View>

              <View style={styles.detailsBtn}>
                <Text style={styles.detailsBtnText}>View Details</Text>
                <Ionicons name="chevron-forward" size={14} color="#0F204B" />
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const totalReports = reports.length;
  const pendingCount = reports.filter((r) => r.status?.toLowerCase() === "pending").length;
  const resolvedCount = reports.filter((r) => r.status?.toLowerCase() === "resolved").length;
  const inProgressCount = reports.filter((r) => r.status?.toLowerCase() === "in-progress").length;

  const filteredReports = reports.filter((item) => {
    if (selectedFilter === "all") return true;
    return item.status?.toLowerCase() === selectedFilter;
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <SafeAreaView edges={["top"]} style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerTitleGroup}>
            <Text style={styles.headerTitle}>My Reports</Text>
            <Text style={styles.headerSub}>{totalReports} total incident{totalReports !== 1 ? "s" : ""}</Text>
          </View>
          <TouchableOpacity onPress={() => loadReports(true)} style={styles.headerBtn}>
            <Ionicons name="refresh" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Stats Bar */}
      {!isLoading && !error && (
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: "#818CF8" }]}>{totalReports}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: "#FCD34D" }]}>{pendingCount}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: "#A78BFA" }]}>{inProgressCount}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: "#34D399" }]}>{resolvedCount}</Text>
            <Text style={styles.statLabel}>Resolved</Text>
          </View>
        </View>
      )}

      {/* Filter Pills */}
      {!isLoading && !error && (
        <View style={styles.filterWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {FILTERS.map((f) => {
              const isActive = selectedFilter === f.id;
              return (
                <TouchableOpacity
                  key={f.id}
                  onPress={() => setSelectedFilter(f.id)}
                  style={[styles.filterPill, isActive && styles.filterPillActive]}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={f.icon as any}
                    size={13}
                    color={isActive ? "#fff" : "#64748B"}
                    style={{ marginRight: 5 }}
                  />
                  <Text style={[styles.filterLabel, isActive && styles.filterLabelActive]}>{f.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Content */}
      {isLoading ? (
        <View style={styles.center}>
          <View style={styles.loadingPulse}>
            <Ionicons name="document-text-outline" size={40} color="#CBD5E1" />
          </View>
          <Text style={styles.loadingText}>Loading your reports...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <View style={styles.errorCircle}>
            <Ionicons name="alert-circle-outline" size={44} color="#EF4444" />
          </View>
          <Text style={styles.errorTitle}>Failed to Load</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => loadReports()}>
            <Ionicons name="refresh" size={16} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filteredReports.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="document-text" size={48} color="#CBD5E1" />
          </View>
          <Text style={styles.emptyTitle}>
            {selectedFilter === "all" ? "No Incident Records" : "No Match Found"}
          </Text>
          <Text style={styles.emptyText}>
            {selectedFilter === "all"
              ? "You haven't submitted any reports yet."
              : `No reports with "${selectedFilter}" status.`}
          </Text>
          <TouchableOpacity style={styles.goReportBtn} onPress={() => router.replace("/(tabs)/home" as any)}>
            <Ionicons name="add" size={20} color="#fff" style={{ marginRight: 4 }} />
            <Text style={styles.goReportText}>Submit a Report</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredReports}
          keyExtractor={(item) => item.id?.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={false}
          onScroll={(e) => {
            onScroll(e);
            scrollY.setValue(e.nativeEvent.contentOffset.y);
          }}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadReports(true)}
              tintColor="#F4B51A"
              colors={["#F4B51A"]}
              progressBackgroundColor="#0F204B"
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    backgroundColor: "#0F204B",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitleGroup: {
    alignItems: "center",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  headerSub: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },
  statsBar: {
    flexDirection: "row",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 14,
    paddingVertical: 14,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "600",
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  statDivider: {
    width: 1,
    backgroundColor: "#F1F5F9",
    alignSelf: "stretch",
  },
  filterWrapper: {
    paddingVertical: 12,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  filterPillActive: {
    backgroundColor: "#0F204B",
    borderColor: "#0F204B",
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
  filterLabelActive: {
    color: "#fff",
  },
  list: {
    padding: 16,
    paddingTop: 4,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  loadingPulse: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  loadingText: {
    marginTop: 8,
    color: "#64748B",
    fontSize: 14,
    fontWeight: "600",
  },
  errorCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#FEF2F2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1E293B",
  },
  errorText: {
    color: "#64748B",
    fontSize: 13,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 20,
  },
  retryBtn: {
    marginTop: 18,
    backgroundColor: "#0F204B",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  retryText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  emptyText: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  goReportBtn: {
    marginTop: 24,
    backgroundColor: "#0F204B",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  goReportText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 13,
  },
  cardContainer: {
    marginBottom: 12,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    overflow: "hidden",
  },
  cardShadow: {
    borderRadius: 18,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 26,
    elevation: 10,
  },
  cardInner: {
    padding: 14,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  crimeIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(15, 32, 75, 0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerContent: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
    minWidth: 0,
  },
  crimeType: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: -0.2,
  },
  headerMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
    gap: 4,
    flexShrink: 1,
    minWidth: 0,
  },
  headerDot: {
    fontSize: 11,
    color: "#CBD5E1",
    marginHorizontal: 2,
    flexShrink: 0,
  },
  reportDate: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "500",
    flexShrink: 1,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
    borderWidth: 1.5,
  },
  statusLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#EF4444",
    marginRight: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  detailsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#EEF2F7",
  },
  detailsBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F204B",
  },
});