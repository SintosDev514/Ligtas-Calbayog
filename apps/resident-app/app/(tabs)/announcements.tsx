import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Animated,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { fetchAnnouncements } from "../../../../shared/services/reportService";

const CATEGORY_META: Record<
  string,
  { bg: string; text: string; icon: string }
> = {
  advisory: { bg: "#EFF6FF", text: "#1D4ED8", icon: "information-circle" },
  alert: { bg: "#FEF2F2", text: "#DC2626", icon: "warning" },
  news: { bg: "#ECFDF5", text: "#059669", icon: "newspaper" },
  event: { bg: "#F5F3FF", text: "#7C3AED", icon: "calendar" },
  default: { bg: "#F8FAFC", text: "#475569", icon: "megaphone" },
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeAgo(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return formatDate(dateStr);
}

export default function AnnouncementsScreen() {
  const router = useRouter();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
    loadAnnouncements();
  }, []);

  const loadAnnouncements = async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError("");
    try {
      const data = await fetchAnnouncements();
      setAnnouncements(data);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    } catch (e: any) {
      setError(e.message || "Failed to load announcements.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = useCallback(() => loadAnnouncements(true), []);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    const cat = item.category?.toLowerCase() || "default";
    const meta = CATEGORY_META[cat] ?? CATEGORY_META.default;
    const isExpanded = expandedId === item.id;

    return (
      <Animated.View
        style={[
          styles.card,
          {
            opacity: fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 1],
            }),
            transform: [
              {
                translateY: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20 * Math.min(index + 1, 5), 0],
                }),
              },
            ],
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => toggleExpand(item.id)}
          style={styles.cardTouchable}
        >
          <View style={styles.cardTop}>
            <View style={[styles.badge, { backgroundColor: meta.bg }]}>
              <Ionicons name={meta.icon as any} size={12} color={meta.text} />
              <Text style={[styles.badgeText, { color: meta.text }]}>
                {item.category ?? "General"}
              </Text>
            </View>
            <Text style={styles.timeAgo}>{timeAgo(item.created_at)}</Text>
          </View>

          <Text
            style={styles.cardTitle}
            numberOfLines={isExpanded ? undefined : 2}
          >
            {item.title}
          </Text>

          <Text
            style={styles.cardContent}
            numberOfLines={isExpanded ? undefined : 3}
          >
            {item.content ?? item.body ?? ""}
          </Text>

          <View style={styles.cardFooter}>
            <View style={styles.footerLeft}>
              <View style={styles.sourceIcon}>
                <Ionicons name="shield-checkmark" size={12} color="#3B82F6" />
              </View>
              <Text style={styles.footerSource}>PNP Calbayog</Text>
            </View>
            <View style={styles.readMore}>
              <Text style={styles.readMoreText}>
                {isExpanded ? "Show less" : "Read more"}
              </Text>
              <Ionicons
                name={isExpanded ? "chevron-up" : "chevron-down"}
                size={14}
                color="#3B82F6"
              />
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.center}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="megaphone-outline" size={40} color="#94A3B8" />
      </View>
      <Text style={styles.emptyTitle}>No Announcements Yet</Text>
      <Text style={styles.emptyText}>
        Check back later for news and advisories from PNP Calbayog.
      </Text>
    </View>
  );

  const renderError = () => (
    <View style={styles.center}>
      <View style={styles.errorIconWrap}>
        <Ionicons name="cloud-offline-outline" size={40} color="#EF4444" />
      </View>
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity
        style={styles.retryBtn}
        onPress={() => loadAnnouncements()}
        activeOpacity={0.8}
      >
        <Ionicons name="refresh" size={16} color="#fff" style={{ marginRight: 6 }} />
        <Text style={styles.retryText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );

  const renderLoading = () => (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#17202b" />
      <Text style={styles.loadingText}>Loading announcements…</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#17202b" />

      {/* Header */}
      <SafeAreaView edges={["top"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Announcements</Text>
            <Text style={styles.headerSub}>PNP Calbayog advisories</Text>
          </View>

          <TouchableOpacity
            onPress={handleRefresh}
            style={styles.backBtn}
          >
            <Ionicons name="refresh" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Content */}
      {isLoading
        ? renderLoading()
        : error
          ? renderError()
          : (
            <FlatList
              data={announcements}
              keyExtractor={(item) => item.id?.toString()}
              renderItem={renderItem}
              contentContainerStyle={
                announcements.length === 0
                  ? styles.emptyList
                  : styles.listContent
              }
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={handleRefresh}
                  tintColor="#17202b"
                  colors={["#17202b"]}
                />
              }
              ListEmptyComponent={renderEmpty}
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

  /* Header */
  header: {
    backgroundColor: "#17202b",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerCenter: {
    alignItems: "center",
    flex: 1,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
  headerSub: {
    color: "#94A3B8",
    fontSize: 11,
    marginTop: 2,
    fontWeight: "500",
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },

  /* List */
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  emptyList: {
    flexGrow: 1,
  },

  /* Card */
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    overflow: "hidden",
  },
  cardTouchable: {
    padding: 16,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  /* Badge */
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "capitalize",
  },

  timeAgo: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "500",
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 8,
    lineHeight: 22,
  },

  cardContent: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 21,
  },

  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  footerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sourceIcon: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
  },
  footerSource: {
    fontSize: 12,
    color: "#3B82F6",
    fontWeight: "600",
  },
  readMore: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  readMoreText: {
    fontSize: 12,
    color: "#3B82F6",
    fontWeight: "600",
  },

  /* States */
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },

  loadingText: {
    marginTop: 14,
    color: "#64748B",
    fontSize: 14,
    fontWeight: "500",
  },

  errorIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#FEF2F2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 14,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 20,
  },
  retryBtn: {
    marginTop: 20,
    backgroundColor: "#17202b",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  retryText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },

  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
    paddingHorizontal: 20,
  },
});
