import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  StatusBar,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker, UrlTile } from "@/components/MapView";
import { supabase } from "../../../../shared/supabase/supabaseClient";
import {
  fetchMessages,
  fetchConversation,
  sendMessage,
} from "../../../../shared/services/messageService";
import { useLocation } from "../../context/LocationContext";
import { useMapStyle } from "../../context/MapStyleContext";

export default function ChatScreen() {
  const router = useRouter();
  const { id: contactId, name: contactName, contact_user_id: contactUserId } = useLocalSearchParams<{
    id: string;
    name: string;
    phone: string;
    relationship: string;
    contact_user_id: string;
  }>();
  const { location, getLocation } = useLocation();
  const { tileUrl, mapStyle } = useMapStyle();

  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const subscriptionRef = useRef<any>(null);

  const loadMessages = useCallback(async () => {
    if (!contactId && !contactUserId) return;
    try {
      const { data: session } = await supabase.auth.getSession();
      const uid = session?.session?.user?.id;
      if (!uid) return;
      setUserId(uid);

      if (contactUserId && uid) {
        const data = await fetchConversation(uid, contactUserId);
        setMessages(data);
      } else {
        const data = await fetchMessages(contactId);
        setMessages(data);
      }
    } catch (e) {
      console.error("Failed to load messages:", e);
    } finally {
      setLoading(false);
    }
  }, [contactId, contactUserId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!userId || !contactUserId) return;

    const conversationId = [userId, contactUserId].sort().join("_");

    const channel = supabase
      .channel("chat-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as any;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, contactUserId]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [messages.length]);

  const handleSend = async () => {
    if (!inputText.trim() || sending) return;

    try {
      setSending(true);
      const { data: session } = await supabase.auth.getSession();
      const user = session?.session?.user;
      if (!user) return;

      const newMsg = await sendMessage(user.id, contactId, {
        content: inputText.trim(),
        receiverId: contactUserId || undefined,
      });
      setMessages((prev) => [...prev, newMsg]);
      setInputText("");
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleShareLocation = async () => {
    try {
      setSending(true);
      const { data: session } = await supabase.auth.getSession();
      const user = session?.session?.user;
      if (!user) return;

      if (!location?.latitude) {
        await getLocation();
      }

      if (!location?.latitude) {
        Alert.alert("Location Unavailable", "Could not get your current location.");
        setSending(false);
        return;
      }

      const newMsg = await sendMessage(user.id, contactId, {
        content: `📍 Current location: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`,
        type: "location",
        latitude: location.latitude,
        longitude: location.longitude,
        receiverId: contactUserId || undefined,
      });
      setMessages((prev) => [...prev, newMsg]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to share location");
    } finally {
      setSending(false);
    }
  };

  const formatTime = (timestamp: string) => {
    const d = new Date(timestamp);
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    if (isToday) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return `${d.getMonth() + 1}/${d.getDate()} ${d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isLocation = item.message_type === "location";
    const isMine = item.sender_id
      ? item.sender_id === userId
      : item.user_id === userId;

    return (
      <View style={[styles.messageBubble, isMine ? styles.myMessage : styles.theirMessage]}>
        {isLocation ? (
          <View style={styles.locationCard}>
            <View style={styles.locationHeader}>
              <Ionicons name="location" size={16} color="#EF4444" />
              <Text style={[styles.locationLabel, isMine ? { color: "#fff" } : { color: "#17202b" }]}>Shared Location</Text>
            </View>
            {item.latitude && item.longitude && (
              <MapView
                style={styles.miniMap}
                scrollEnabled={false}
                zoomEnabled={false}
                mapType="none"
                mapStyle={mapStyle}
                initialRegion={{
                  latitude: item.latitude,
                  longitude: item.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
              >
                <UrlTile urlTemplate={tileUrl} />
                <Marker
                  coordinate={{
                    latitude: item.latitude,
                    longitude: item.longitude,
                  }}
                />
              </MapView>
            )}
            <Text style={[styles.locationCoords, isMine ? { color: "rgba(255,255,255,0.6)" } : { color: "#94A3B8" }]}>
              {item.latitude?.toFixed(6)}, {item.longitude?.toFixed(6)}
            </Text>
          </View>
        ) : (
          <Text style={[styles.messageText, isMine ? { color: "#fff" } : { color: "#17202b" }]}>{item.content}</Text>
        )}
        <Text style={[styles.messageTime, isMine ? { color: "rgba(255,255,255,0.5)" } : { color: "#94A3B8" }]}>{formatTime(item.created_at)}</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0F204B" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <SafeAreaView edges={["top"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#0F204B" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerName} numberOfLines={1}>
              {contactName || "Contact"}
            </Text>
          </View>
          <View style={{ width: 38 }} />
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyChat}>
            <Ionicons name="chatbubble-ellipses-outline" size={56} color="#CBD5E1" />
            <Text style={styles.emptyChatTitle}>No Messages Yet</Text>
            <Text style={styles.emptyChatSub}>
              Send a message or share your location
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
          />
        )}

        <View style={styles.inputBar}>
          <TouchableOpacity
            style={styles.locationBtn}
            onPress={handleShareLocation}
            disabled={sending}
          >
            <Ionicons name="location-outline" size={22} color="#1D4ED8" />
          </TouchableOpacity>
          <TextInput
            style={styles.textInput}
            placeholder="Type a message..."
            placeholderTextColor="#94A3B8"
            value={inputText}
            onChangeText={setInputText}
            multiline={false}
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              !inputText.trim() && styles.sendBtnDisabled,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },
  flex: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },

  header: { backgroundColor: "#F1F5F9" },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  backBtn: {
    backgroundColor: "#E2E8F0",
    borderRadius: 20,
    padding: 8,
  },
  headerInfo: { flex: 1, marginHorizontal: 12 },
  headerName: { fontSize: 17, fontWeight: "700", color: "#0F204B" },

  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  messageBubble: {
    maxWidth: "80%",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  myMessage: {
    alignSelf: "flex-end",
    backgroundColor: "#17202b",
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    alignSelf: "flex-start",
    backgroundColor: "#fff",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  messageText: { fontSize: 15, lineHeight: 20 },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
    alignSelf: "flex-end",
  },

  locationCard: {
    borderRadius: 12,
    overflow: "hidden",
  },
  locationHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  locationLabel: { fontSize: 13, fontWeight: "600", marginLeft: 6 },
  miniMap: { width: 200, height: 120, borderRadius: 8 },
  locationCoords: {
    fontSize: 11,
    marginTop: 4,
  },

  emptyChat: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyChatTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F204B",
    marginTop: 12,
  },
  emptyChatSub: { fontSize: 14, color: "#94A3B8", textAlign: "center", marginTop: 4 },

  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  locationBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: "#0F204B",
    backgroundColor: "#F8FAFC",
    maxHeight: 40,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#17202b",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  sendBtnDisabled: { backgroundColor: "#CBD5E1" },
});
