import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Swipeable } from "react-native-gesture-handler";
import { supabase } from "../../../../shared/supabase/supabaseClient";
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from "../../../../shared/services/messageService";
import { getCached, setCache } from "../../../../shared/services/cacheService";
import { setupPushNotifications, showLocalNotification } from "../../../../shared/services/pushService";
import { useFocusEffect } from "@react-navigation/native";

const TYPE_META: Record<string, { icon: string; color: string }> = {
  contact_request: { icon: "person-add", color: "#3B82F6" },
  contact_request_accepted: { icon: "checkmark-circle", color: "#16A34A" },
  message: { icon: "chatbubble", color: "#8B5CF6" },
  alert: { icon: "warning", color: "#DC2626" },
  announcement: { icon: "megaphone", color: "#D97706" },
  admin_message: { icon: "shield-checkmark", color: "#0F204B" },
  report_update: { icon: "document-text", color: "#3B82F6" },
  default: { icon: "notifications", color: "#64748B" },
};

function timeAgo(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const pushReady = useRef(false);

  useEffect(() => {
    setupPushNotifications().then(() => { pushReady.current = true; });
  }, []);

  const loadNotifications = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError("");

    const cached = await getCached("notifications");
    if (cached) {
      setNotifications(cached.data);
      if (!isRefresh) setIsLoading(false);
    }

    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      if (!userId) return;
      setCurrentUserId(userId);
      const data = await fetchNotifications(userId);
      setNotifications(data);
      setCache("notifications", data);
    } catch (e: any) {
      if (!cached) setError(e.message || "Failed to load notifications.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useFocusEffect(
    React.useCallback(() => {
      if (currentUserId) {
        markAllNotificationsRead(currentUserId).then(() => {
          setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        });
      }
    }, [currentUserId])
  );

  useEffect(() => {
    if (!currentUserId) return;
    const channel = supabase.channel(`notifications-live-${Date.now()}`);
    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${currentUserId}` },
      (payload) => {
        const n = payload.new as any;
        setNotifications((prev) => [n, ...prev]);
        if (pushReady.current) {
          showLocalNotification(n.title || "New Notification", n.body || "");
        }
      }
    );
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUserId]);

  const handleRefresh = () => loadNotifications(true);

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const handleDelete = async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      await deleteNotification(id);
    } catch {
      loadNotifications();
    }
  };

  const handleMarkAllRead = async () => {
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;
    if (!userId) return;
    await markAllNotificationsRead(userId);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const renderItem = ({ item }: { item: any }) => {
    const type = item.type?.toLowerCase() || "default";
    const meta = TYPE_META[type] ?? TYPE_META.default;

    const renderRightActions = () => (
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={() => handleDelete(item.id)}
        activeOpacity={0.8}
      >
        <Ionicons name="trash-outline" size={22} color="#fff" />
        <Text style={styles.deleteActionText}>Delete</Text>
      </TouchableOpacity>
    );

    return (
      <Swipeable
        renderRightActions={renderRightActions}
        overshootRight={false}
        rightThreshold={40}
      >
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            handleMarkRead(item.id);
            if (item.type === "announcement") {
              router.push("/(tabs)/announcements");
            } else if (item.type === "message" && item.data?.sender_id) {
              router.push({
                pathname: "/(tabs)/chat",
                params: {
                  contact_user_id: item.data.sender_id,
                  id: item.data.contact_id || "",
                  name: item.title?.replace("Message from ", "") || "",
                  phone: "",
                },
              });
            } else if (item.type === "contact_request" || item.type === "contact_request_accepted") {
              router.push("/(tabs)/messages");
            } else if (item.type === "report_update" && item.data?.report_id) {
              router.push({ pathname: "/(tabs)/my-reports" as any, params: { filter: "all" } });
            }
          }}
          style={[styles.card, !item.read && styles.cardUnread]}
        >
          <View style={[styles.iconWrap, { backgroundColor: meta.color + "18" }]}>
            <Ionicons name={meta.icon as any} size={18} color={meta.color} />
          </View>
          <View style={styles.cardBody}>
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.timeAgo}>{timeAgo(item.created_at)}</Text>
            </View>
            {item.body ? (
              <Text style={styles.cardBodyText} numberOfLines={2}>
                {item.body}
              </Text>
            ) : null}
          </View>
          {!item.read && <View style={styles.unreadDot} />}
        </TouchableOpacity>
      </Swipeable>
    );
  };

  const renderEmpty = () => (
    <View style={styles.center}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="notifications-off-outline" size={40} color="#94A3B8" />
      </View>
      <Text style={styles.emptyTitle}>No Notifications Yet</Text>
      <Text style={styles.emptyText}>
        You'll see your activity and updates here.
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
        onPress={() => loadNotifications()}
        activeOpacity={0.8}
      >
        <Ionicons name="refresh" size={16} color="#fff" style={{ marginRight: 6 }} />
        <Text style={styles.retryText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F7FA" }}>
      <StatusBar barStyle="light-content" backgroundColor="#17202b" />
      <SafeAreaView style={{ flex: 1, backgroundColor: "#17202b" }}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Notifications</Text>
              {unreadCount > 0 && (
                <Text style={styles.headerSub}>
                  {unreadCount} unread
                </Text>
              )}
            </View>
            {unreadCount > 0 ? (
              <TouchableOpacity
                style={styles.markAllBtn}
                onPress={handleMarkAllRead}
              >
                <Text style={styles.markAllText}>Mark all read</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ width: 80 }} />
            )}
          </View>
        </View>

        {isLoading && !isRefreshing ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#17202b" />
            <Text style={styles.loadingText}>Loading notifications...</Text>
          </View>
        ) : error ? (
          renderError()
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={[
              styles.listContent,
              notifications.length === 0 && styles.emptyList,
            ]}
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
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: "#17202b",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
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
  markAllBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "rgba(59,130,246,0.15)",
  },
  markAllText: {
    color: "#3B82F6",
    fontSize: 12,
    fontWeight: "600",
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  emptyList: {
    flexGrow: 1,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 10,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  cardUnread: {
    backgroundColor: "#F0F7FF",
    borderColor: "#BFDBFE",
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  cardBody: {
    flex: 1,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    flex: 1,
    marginRight: 8,
  },
  cardBodyText: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 18,
  },
  timeAgo: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "500",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#3B82F6",
    marginLeft: 8,
  },
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
  deleteAction: {
    backgroundColor: "#DC2626",
    borderRadius: 14,
    marginBottom: 10,
    marginLeft: -14,
    width: 80,
    justifyContent: "center",
    alignItems: "center",
  },
  deleteActionText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 4,
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
