import { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Modal as RNModal,
  Pressable,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../../shared/supabase/supabaseClient";
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  deleteAllNotifications,
} from "../../../shared/services/messageService";
import { getCached, setCache } from "../../../shared/services/cacheService";
import { setupPushNotifications, showLocalNotification } from "../../../shared/services/pushService";

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

type Props = {
  visible: boolean;
  onClose: () => void;
  onUnreadChange: (count: number) => void;
};

export function NotificationsSheet({ visible, onClose, onUnreadChange }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
    if (visible) {
      loadNotifications();
      supabase.auth.getSession().then(({ data }: { data: any }) => {
        const userId = data?.session?.user?.id;
        if (!userId) return;
        markAllNotificationsRead(userId).then(() => {
          setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
          onUnreadChange(0);
        });
      });
    }
  }, [visible]);

  useEffect(() => {
    if (!currentUserId) return;
    const channel = supabase.channel(`notifications-live-${Date.now()}`);
    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${currentUserId}` },
      (payload: any) => {
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

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (visible) onUnreadChange(unreadCount);
  }, [unreadCount, visible]);

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
    onUnreadChange(0);
  };

  const handleClearAll = () => {
    if (notifications.length === 0) return;
    Alert.alert(
      "Clear All Notifications",
      `This will permanently delete all ${notifications.length} notifications. Are you sure?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            const { data: session } = await supabase.auth.getSession();
            const userId = session?.session?.user?.id;
            if (!userId) return;
            setNotifications([]);
            onUnreadChange(0);
            try {
              await deleteAllNotifications(userId);
            } catch {
              loadNotifications();
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const navigateAndClose = (push: () => void) => {
    onClose();
    push();
  };

  const renderItem = ({ item }: { item: any }) => {
    const type = item.type?.toLowerCase() || "default";
    const meta = TYPE_META[type] ?? TYPE_META.default;

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        delayLongPress={450}
        onLongPress={() => handleDelete(item.id)}
        onPress={() => {
            handleMarkRead(item.id);
            if (item.type === "announcement") {
              navigateAndClose(() => router.push("/(tabs)/announcements"));
            } else if (item.type === "message" && item.data?.sender_id) {
              navigateAndClose(() =>
                router.push({
                  pathname: "/(tabs)/chat",
                  params: {
                    contact_user_id: item.data.sender_id,
                    id: item.data.contact_id || "",
                    name: item.title?.replace("Message from ", "") || "",
                    phone: "",
                  },
                })
              );
            } else if (item.type === "contact_request" || item.type === "contact_request_accepted") {
              navigateAndClose(() => router.push("/(tabs)/messages"));
            } else if (item.type === "report_update" && item.data?.report_id) {
              navigateAndClose(() => router.push({ pathname: "/(tabs)/my-reports" as any, params: { filter: "all" } }));
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

  return (
    <RNModal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.modalRoot}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]}>
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>

          <View style={styles.header}>
            <View style={styles.headerRow}>
              <View style={styles.headerSideSpacer} />
              <View style={styles.headerCenter}>
                <Text style={styles.headerTitle}>Notifications</Text>
                {unreadCount > 0 && (
                  <Text style={styles.headerSub}>{unreadCount} unread</Text>
                )}
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
            {notifications.length > 0 && (
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, unreadCount === 0 && styles.actionBtnDisabled]}
                  onPress={handleMarkAllRead}
                  disabled={unreadCount === 0}
                  activeOpacity={0.7}
                >
                  <Ionicons name="checkmark-done" size={15} color="#F4B51A" />
                  <Text style={styles.markAllText}>Mark all read</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.clearAllBtn]}
                  onPress={handleClearAll}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={15} color="#F87171" />
                  <Text style={styles.clearAllText}>Clear all</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {isLoading && !isRefreshing ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#0F204B" />
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
                  tintColor="#0F204B"
                  colors={["#0F204B"]}
                />
              }
              ListEmptyComponent={renderEmpty}
            />
          )}
        </View>
      </View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    height: "88%",
    backgroundColor: "#F5F7FA",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  handleWrap: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: "#0F204B",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  header: {
    backgroundColor: "#0F204B",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerSideSpacer: {
    width: 38,
    height: 38,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
  },
  headerSub: {
    color: "#F4B51A",
    fontSize: 11,
    marginTop: 2,
    fontWeight: "600",
  },
  markAllText: {
    color: "#F4B51A",
    fontSize: 12,
    fontWeight: "700",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  actionBtnDisabled: {
    opacity: 0.4,
  },
  clearAllBtn: {
    backgroundColor: "rgba(248,113,113,0.14)",
    borderColor: "rgba(248,113,113,0.3)",
  },
  clearAllText: {
    color: "#F87171",
    fontSize: 12,
    fontWeight: "700",
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.12)",
    justifyContent: "center",
    alignItems: "center",
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
    backgroundColor: "#0F204B",
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