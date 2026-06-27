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
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Linking,
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
  updateMessage,
  deleteMessage,
} from "../../../../shared/services/messageService";
import { useLocation } from "../../context/LocationContext";
import { useMapStyle } from "../../context/MapStyleContext";

export default function ChatScreen() {
  const router = useRouter();
  const { id: contactId, name: contactName, phone: contactPhone, contact_user_id: contactUserId } = useLocalSearchParams<{
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
  const [contextMsg, setContextMsg] = useState<any | null>(null);
  const [showContext, setShowContext] = useState(false);
  const [editMsg, setEditMsg] = useState<any | null>(null);
  const [editText, setEditText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
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

  const handleLongPress = (msg: any) => {
    setContextMsg(msg);
    setShowContext(true);
  };

  const handleReply = () => {
    setInputText(`@${contactName || "Contact"} `);
    setShowContext(false);
    setContextMsg(null);
  };

  const handleEditMessage = () => {
    setEditMsg(contextMsg);
    setEditText(contextMsg?.content || "");
    setShowContext(false);
  };

  const handleSaveEdit = async () => {
    if (!editText.trim() || !editMsg) return;
    try {
      await updateMessage(editMsg.id, { content: editText.trim(), edited: true });
      setMessages((prev) =>
        prev.map((m) =>
          m.id === editMsg.id ? { ...m, content: editText.trim(), edited: true } : m
        )
      );
      setEditMsg(null);
      setEditText("");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to edit message");
    }
  };

  const handleDeleteMessage = () => {
    if (!contextMsg) return;
    Alert.alert("Delete Message", "Are you sure?", [
      { text: "Cancel", style: "cancel", onPress: () => setShowContext(false) },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteMessage(contextMsg.id);
            setMessages((prev) => prev.filter((m) => m.id !== contextMsg.id));
            setShowContext(false);
            setContextMsg(null);
          } catch (e: any) {
            Alert.alert("Error", e.message || "Failed to delete message");
          }
        },
      },
    ]);
  };

  const handleReact = (emoji: string) => {
    if (!contextMsg) return;
    const existing = contextMsg.reaction || "";
    const newReaction = existing === emoji ? "" : emoji;
    updateMessage(contextMsg.id, { reaction: newReaction }).catch(() => {});
    setMessages((prev) =>
      prev.map((m) =>
        m.id === contextMsg.id ? { ...m, reaction: newReaction } : m
      )
    );
    setShowEmojiPicker(false);
    setShowContext(false);
    setContextMsg(null);
  };

  const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

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
      <TouchableOpacity
        activeOpacity={0.8}
        onLongPress={() => handleLongPress(item)}
        delayLongPress={400}
      >
        <View style={[styles.messageBubble, isMine ? styles.myMessage : styles.theirMessage]}>
          {isLocation ? (
            <View style={styles.locationCard}>
              <View style={styles.locationHeader}>
                <Ionicons name="location" size={16} color="#EF4444" />
                <Text style={[styles.locationLabel, isMine ? { color: "#fff" } : { color: "#17202b" }]}>Shared Location</Text>
              </View>
              {item.latitude && item.longitude && (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() =>
                    router.push({
                      pathname: "/fullscreen-map",
                      params: {
                        latitude: item.latitude.toString(),
                        longitude: item.longitude.toString(),
                        title: "Shared Location",
                      },
                    })
                  }
                >
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
                </TouchableOpacity>
              )}
              <Text style={[styles.locationCoords, isMine ? { color: "rgba(255,255,255,0.6)" } : { color: "#94A3B8" }]}>
                {item.latitude?.toFixed(6)}, {item.longitude?.toFixed(6)}
              </Text>
            </View>
          ) : (
            <Text style={[styles.messageText, isMine ? { color: "#fff" } : { color: "#17202b" }]}>{item.content}</Text>
          )}
          {item.edited && (
            <Text style={[styles.editedTag, isMine ? { color: "rgba(255,255,255,0.4)" } : { color: "#94A3B8" }]}>edited</Text>
          )}
          <View style={styles.messageFooter}>
            {item.reaction && (
              <Text style={styles.reactionBadge}>{item.reaction}</Text>
            )}
            <TouchableOpacity
              onPress={() => { setContextMsg(item); setShowEmojiPicker(true); }}
              style={[styles.reactBtn, isMine ? { backgroundColor: "rgba(255,255,255,0.1)" } : { backgroundColor: "#E2E8F0" }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="happy-outline" size={12} color={isMine ? "rgba(255,255,255,0.5)" : "#94A3B8"} />
            </TouchableOpacity>
            <Text style={[styles.messageTime, isMine ? { color: "rgba(255,255,255,0.5)" } : { color: "#94A3B8" }]}>{formatTime(item.created_at)}</Text>
          </View>
        </View>
      </TouchableOpacity>
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
          {contactPhone ? (
            <TouchableOpacity
              style={styles.phoneBtn}
              onPress={() => Linking.openURL(`tel:${contactPhone}`)}
            >
              <Ionicons name="call-outline" size={20} color="#22C55E" />
            </TouchableOpacity>
          ) : null}
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

      {/* Context Menu Modal */}
      <Modal
        visible={showContext}
        transparent
        animationType="fade"
        onRequestClose={() => setShowContext(false)}
      >
        <TouchableOpacity
          style={styles.contextOverlay}
          activeOpacity={1}
          onPress={() => setShowContext(false)}
        >
          <View style={styles.contextMenu}>
            <TouchableOpacity style={styles.contextItem} onPress={handleReply}>
              <Ionicons name="arrow-undo" size={20} color="#17202b" />
              <Text style={styles.contextItemText}>Reply</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.contextItem} onPress={() => { setShowEmojiPicker(true); }}>
              <Ionicons name="happy-outline" size={20} color="#17202b" />
              <Text style={styles.contextItemText}>React</Text>
            </TouchableOpacity>
            {contextMsg && ((contextMsg.sender_id
              ? contextMsg.sender_id === userId
              : contextMsg.user_id === userId)) && (
              <>
                <View style={styles.contextDivider} />
                <TouchableOpacity style={styles.contextItem} onPress={handleEditMessage}>
                  <Ionicons name="pencil" size={20} color="#17202b" />
                  <Text style={styles.contextItemText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.contextItem} onPress={handleDeleteMessage}>
                  <Ionicons name="trash-outline" size={20} color="#DC2626" />
                  <Text style={[styles.contextItemText, { color: "#DC2626" }]}>Delete</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Emoji Picker Modal */}
      <Modal
        visible={showEmojiPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEmojiPicker(false)}
      >
        <View style={styles.contextOverlay}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => { setShowEmojiPicker(false); setContextMsg(null); }}
          />
          <View style={styles.emojiPicker}>
            <Text style={styles.emojiPickerTitle}>React with emoji</Text>
            <View style={styles.emojiRow}>
              {EMOJIS.map((emoji) => (
                <TouchableOpacity key={emoji} style={styles.emojiBtn} onPress={() => handleReact(emoji)}>
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Message Modal */}
      <Modal
        visible={!!editMsg}
        transparent
        animationType="fade"
        onRequestClose={() => { setEditMsg(null); setEditText(""); }}
      >
        <View style={styles.editOverlay}>
          <View style={styles.editModal}>
            <Text style={styles.editTitle}>Edit Message</Text>
            <TextInput
              style={styles.editInput}
              value={editText}
              onChangeText={setEditText}
              multiline
              autoFocus
            />
            <View style={styles.editActions}>
              <TouchableOpacity
                style={styles.editCancelBtn}
                onPress={() => { setEditMsg(null); setEditText(""); }}
              >
                <Text style={styles.editCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.editSaveBtn}
                onPress={handleSaveEdit}
              >
                <Text style={styles.editSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  miniMap: { width: 200, height: 60, borderRadius: 8, flex: 0 },
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
  phoneBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F0FDF4",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
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

  editedTag: {
    fontSize: 10,
    fontStyle: "italic",
    marginTop: 2,
  },
  reactionBadge: {
    fontSize: 20,
    marginRight: 4,
  },
  reactBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 6,
  },
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },

  contextOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  contextMenu: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingBottom: 34,
    paddingHorizontal: 20,
  },
  contextItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 12,
  },
  contextItemText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#17202b",
  },
  contextDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 4,
  },

  emojiPicker: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 34,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  emojiPickerTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#17202b",
    marginBottom: 16,
  },
  emojiRow: {
    flexDirection: "row",
    gap: 12,
  },
  emojiBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  emojiText: {
    fontSize: 22,
  },

  editOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  editModal: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
  },
  editTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#17202b",
    marginBottom: 12,
  },
  editInput: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: "#17202b",
    minHeight: 80,
    textAlignVertical: "top",
  },
  editActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 12,
  },
  editCancelBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
  },
  editCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#64748B",
  },
  editSaveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#17202b",
  },
  editSaveText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
});
