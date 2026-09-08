import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
} from "react-native";
import { useRouter, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../../shared/supabase/supabaseClient";

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

const DISPLAY_MS = 5000;

export default function NotificationPopup() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [notification, setNotification] = useState<any>(null);

  const translateY = useRef(new Animated.Value(-140)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<any>(null);
  const visibleRef = useRef(false);

  useEffect(() => {
let mounted = true;
  supabase.auth.getSession().then(({ data }: { data: any }) => {
    if (mounted) setCurrentUserId(data.session?.user?.id ?? null);
  });
  const { data: authListener } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
    if (mounted) setCurrentUserId(session?.user?.id ?? null);
  });
    return () => {
      mounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const hidePopup = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    visibleRef.current = false;
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -140,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start(() => setNotification(null));
  }, [translateY, opacity]);

  const showPopup = useCallback(
    (n: any) => {
      if (visibleRef.current) {
        hidePopup();
      }
      setNotification(n);
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 320,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 320,
          useNativeDriver: true,
        }),
      ]).start();
      visibleRef.current = true;
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(hidePopup, DISPLAY_MS);
    },
    [translateY, opacity, hidePopup],
  );

  useEffect(() => {
    if (!currentUserId) return;
    const channel = supabase
      .channel(`notif-popup-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${currentUserId}` },
        (payload: any) => {
          showPopup(payload.new as any);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, showPopup]);

  useEffect(() => {
    if (notification && pathname === "/(tabs)/notifications") {
      hidePopup();
    }
  }, [pathname, notification, hidePopup]);

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  if (!notification) return null;

  const type = (notification.type || "default").toLowerCase();
  const meta = TYPE_META[type] ?? TYPE_META.default;

  const handlePress = () => {
    hidePopup();
    router.push("/(tabs)/notifications" as any);
  };

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFill, { zIndex: 1000, elevation: 1000 }]}
    >
      <Animated.View
        style={[
          styles.container,
          {
            paddingTop: insets.top + 8,
            transform: [{ translateY }],
            opacity,
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handlePress}
          style={styles.card}
        >
          <View style={[styles.iconWrap, { backgroundColor: meta.color + "1A" }]}>
            <Ionicons name={meta.icon as any} size={20} color={meta.color} />
          </View>
          <View style={styles.body}>
            <Text style={styles.title} numberOfLines={1}>
              {notification.title || "New Notification"}
            </Text>
            {notification.body ? (
              <Text style={styles.message} numberOfLines={2}>
                {notification.body}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={hidePopup}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={16} color="#94A3B8" />
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  body: {
    flex: 1,
    paddingRight: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  message: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
    lineHeight: 16,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
    backgroundColor: "#F1F5F9",
  },
});