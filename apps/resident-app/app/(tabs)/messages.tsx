import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../../../shared/supabase/supabaseClient";
import {
  fetchContacts,
  fetchLatestMessagePerContact,
  addContact,
  searchUsers,
  sendContactRequest,
  fetchPendingRequests,
} from "../../../../shared/services/messageService";

const RELATIONSHIPS = ["Family", "Friend", "Relative", "Spouse", "Neighbor"];

export default function MessagesScreen() {
  const router = useRouter();
  const [contacts, setContacts] = useState<any[]>([]);
  const [latestMessages, setLatestMessages] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newContact, setNewContact] = useState({
    name: "",
    phoneNumber: "",
    relationship: "Friend",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [contactPhotos, setContactPhotos] = useState<Record<string, string>>({});
  const [pendingCount, setPendingCount] = useState(0);
  const [showRequestsModal, setShowRequestsModal] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const user = session?.session?.user;
      if (!user) return;

      const [contactsData, msgs, reqs] = await Promise.all([
        fetchContacts(user.id),
        fetchLatestMessagePerContact(user.id),
        fetchPendingRequests(user.id).catch(() => []),
      ]);

      setContacts(contactsData);
      setPendingRequests(reqs);
      setPendingCount(reqs.length);

      const phones = contactsData.map((c: any) => c.phone_number).filter(Boolean);
      if (phones.length > 0) {
        const { data: profiles } = await supabase
          .rpc("get_contact_photos", { phones });
        const photoMap: Record<string, string> = {};
        for (const p of profiles ?? []) {
          if (p.avatar_url) {
            if (p.avatar_url.startsWith("http")) {
              photoMap[p.phone_number] = p.avatar_url;
            } else {
              const { data: pub } = supabase.storage
                .from("profile-photos")
                .getPublicUrl(p.avatar_url.replace(/^profile-photos\//, ""));
              if (pub?.publicUrl) photoMap[p.phone_number] = pub.publicUrl;
            }
          }
        }
        setContactPhotos(photoMap);
      }

      const map: Record<string, any> = {};
      for (const m of msgs) {
        map[m.contact_id] = m;
      }
      setLatestMessages(map);
    } catch (e) {
      console.error("Failed to load messages data:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddContact = async () => {
    if (!newContact.name.trim() || !newContact.phoneNumber.trim()) {
      Alert.alert("Required", "Name and phone number are required");
      return;
    }

    try {
      const { data: session } = await supabase.auth.getSession();
      const user = session?.session?.user;
      if (!user) return;

      const { data: existing } = await supabase
        .rpc("get_user_by_phone", { phone: newContact.phoneNumber.trim() })
        .maybeSingle();

      if (existing) {
        await sendContactRequest(user.id, {
          phoneNumber: newContact.phoneNumber.trim(),
          relationship: newContact.relationship,
        });
        Alert.alert("Request Sent", "Contact request has been sent. They need to accept it.");
      } else {
        await addContact(user.id, newContact);
        Alert.alert("Added", "Contact added to your list.");
      }

      setShowAddModal(false);
      setNewContact({ name: "", phoneNumber: "", relationship: "Friend" });
      setSearchQuery("");
      setSearchResults([]);
      setLoading(true);
      loadData();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to add contact");
    }
  };

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchUsers(searchQuery);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

  const getLastMessagePreview = (contactId: string) => {
    const msg = latestMessages[contactId];
    if (!msg) return "No messages yet";
    if (msg.message_type === "location") return "📍 Shared a location";
    return msg.content || "No messages yet";
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
          <Text style={styles.headerTitle}>Messages</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => setShowRequestsModal(true)}
            >
              <Ionicons name="people-outline" size={22} color="#0F204B" />
              {pendingCount > 0 && (
                <View style={styles.badgeDot}>
                  <Text style={styles.badgeText}>{pendingCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => setShowAddModal(true)}
            >
              <Ionicons name="person-add" size={22} color="#0F204B" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {contacts.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="chatbubbles-outline" size={64} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>No Contacts Yet</Text>
          <Text style={styles.emptySubtitle}>
            Add your family and friends to start messaging
          </Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => setShowAddModal(true)}
          >
            <Ionicons name="person-add" size={20} color="#fff" />
            <Text style={styles.emptyBtnText}>Add Contact</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {contacts.map((contact) => (
            <TouchableOpacity
              key={contact.id}
              style={styles.contactItem}
              activeOpacity={0.7}
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/chat",
                  params: { id: contact.id, name: contact.name, phone: contact.phone_number, relationship: contact.relationship, contact_user_id: contact.contact_user_id || "" },
                })
              }
            >
              <View style={styles.avatar}>
                {contactPhotos[contact.phone_number] ? (
                  <Image
                    source={{ uri: contactPhotos[contact.phone_number] }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <Text style={styles.avatarText}>
                    {getInitials(contact.name)}
                  </Text>
                )}
              </View>
              <View style={styles.contactInfo}>
                <View style={styles.contactTopRow}>
                  <Text style={styles.contactName} numberOfLines={1}>
                    {contact.name}
                  </Text>
                  <View style={styles.relationshipBadge}>
                    <Text style={styles.relationshipText}>
                      {contact.relationship}
                    </Text>
                  </View>
                </View>
                <Text style={styles.lastMessage} numberOfLines={1}>
                  {getLastMessagePreview(contact.id)}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.deleteContactBtn}
                onPress={() => {
                  Alert.alert(
                    "Remove Contact",
                    `Remove ${contact.name} from your contacts?`,
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Remove",
                        style: "destructive",
                        onPress: async () => {
                          try {
                            const { deleteContact } = await import("../../../../shared/services/messageService");
                            await deleteContact(contact.id);
                            setContacts((prev) => prev.filter((c) => c.id !== contact.id));
                          } catch (e: any) {
                            Alert.alert("Error", e.message);
                          }
                        },
                      },
                    ]
                  );
                }}
              >
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Add Contact Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
        onRequestClose={() => { setShowAddModal(false); setSearchQuery(""); setSearchResults([]); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Contact</Text>
              <TouchableOpacity onPress={() => { setShowAddModal(false); setSearchQuery(""); setSearchResults([]); }}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Search Registered Users</Text>
            <TextInput
              style={styles.input}
              placeholder="Type name to search..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searching && (
              <ActivityIndicator size="small" color="#1565C0" style={{ marginVertical: 8 }} />
            )}
            {searchResults.length > 0 && (
              <ScrollView style={{ maxHeight: 180, marginBottom: 12 }}>
                {searchResults.map((user, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.searchResultRow}
                    onPress={() => {
                      Alert.alert(
                        `Send request to ${user.full_name}?`,
                        "Choose relationship:",
                        [
                          ...RELATIONSHIPS.map((rel) => ({
                            text: rel,
                            onPress: async () => {
                              try {
                                const { data: session } = await supabase.auth.getSession();
                                const uid = session?.session?.user?.id;
                                if (!uid) return;
                                await sendContactRequest(uid, {
                                  phoneNumber: user.phone_number || "",
                                  relationship: rel,
                                });
                                Alert.alert("Request Sent", "They'll need to accept your request.");
                                setSearchQuery("");
                                setSearchResults([]);
                                loadData();
                              } catch (e: any) {
                                Alert.alert("Error", e.message);
                              }
                            },
                          })),
                          { text: "Cancel", style: "cancel" },
                        ],
                      );
                    }}
                  >
                    <View style={styles.searchResultAvatar}>
                      <Text style={styles.searchResultAvatarText}>
                        {user.full_name?.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase() || "?"}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.searchResultName}>{user.full_name}</Text>
                      {user.phone_number && (
                        <Text style={styles.searchResultPhone}>{user.phone_number}</Text>
                      )}
                    </View>
                    <Ionicons name="add-circle" size={22} color="#1565C0" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter full name"
              placeholderTextColor="#94A3B8"
              value={newContact.name}
              onChangeText={(t) => setNewContact({ ...newContact, name: t })}
            />

            <Text style={styles.inputLabel}>Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter phone number"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
              value={newContact.phoneNumber}
              onChangeText={(t) =>
                setNewContact({ ...newContact, phoneNumber: t })
              }
            />

            <Text style={styles.inputLabel}>Relationship</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.relationshipRow}
            >
              {RELATIONSHIPS.map((rel) => (
                <TouchableOpacity
                  key={rel}
                  style={[
                    styles.relationChip,
                    newContact.relationship === rel &&
                      styles.relationChipActive,
                  ]}
                  onPress={() =>
                    setNewContact({ ...newContact, relationship: rel })
                  }
                >
                  <Text
                    style={[
                      styles.relationChipText,
                      newContact.relationship === rel &&
                        styles.relationChipTextActive,
                    ]}
                  >
                    {rel}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleAddContact}
            >
              <Text style={styles.saveBtnText}>Save Contact</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Pending Requests Modal */}
      <Modal
        visible={showRequestsModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowRequestsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "70%" }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pending Requests</Text>
              <TouchableOpacity onPress={() => setShowRequestsModal(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            {pendingRequests.length === 0 ? (
              <View style={{ paddingVertical: 30, alignItems: "center" }}>
                <Ionicons name="people-outline" size={40} color="#CBD5E1" />
                <Text style={{ marginTop: 12, color: "#94A3B8" }}>No pending requests</Text>
              </View>
            ) : (
              <ScrollView>
                {pendingRequests.map((req) => (
                  <View key={req.id} style={styles.requestItem}>
                    <View style={styles.requestAvatar}>
                      <Text style={styles.requestAvatarText}>
                        {req.from_name?.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase() || "?"}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.searchResultName}>{req.from_name}</Text>
                      <Text style={styles.searchResultPhone}>{req.from_phone} · {req.relationship}</Text>
                    </View>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TouchableOpacity
                        style={styles.acceptBtn}
                        onPress={async () => {
                          try {
                            const { respondToRequest } = await import("../../../../shared/services/messageService");
                            await respondToRequest(req.id, "accepted");
                            setPendingRequests((prev) => prev.filter((r) => r.id !== req.id));
                            setPendingCount((c) => c - 1);
                            loadData();
                            Alert.alert("Accepted", `${req.from_name} is now a contact!`);
                          } catch (e: any) {
                            Alert.alert("Error", e.message);
                          }
                        }}
                      >
                        <Ionicons name="checkmark" size={18} color="#fff" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.rejectBtn}
                        onPress={async () => {
                          try {
                            const { respondToRequest } = await import("../../../../shared/services/messageService");
                            await respondToRequest(req.id, "rejected");
                            setPendingRequests((prev) => prev.filter((r) => r.id !== req.id));
                            setPendingCount((c) => c - 1);
                          } catch (e: any) {
                            Alert.alert("Error", e.message);
                          }
                        }}
                      >
                        <Ionicons name="close" size={18} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },
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
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#0F204B" },
  addBtn: {
    backgroundColor: "#E2E8F0",
    borderRadius: 20,
    padding: 8,
  },

  list: { flex: 1 },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 10,
    padding: 14,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#17202b",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: { color: "#F4B51A", fontSize: 16, fontWeight: "700" },
  avatarImage: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  contactInfo: { flex: 1 },
  contactTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  contactName: { fontSize: 15, fontWeight: "600", color: "#0F204B", flex: 1 },
  relationshipBadge: {
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  relationshipText: { fontSize: 11, color: "#1D4ED8", fontWeight: "500" },
  lastMessage: { fontSize: 13, color: "#94A3B8" },
  deleteContactBtn: {
    padding: 8,
    marginLeft: 4,
  },

  searchResultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  searchResultAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  searchResultAvatarText: { fontSize: 12, fontWeight: "700", color: "#1565C0" },
  searchResultName: { fontSize: 14, fontWeight: "600", color: "#0F204B" },
  searchResultPhone: { fontSize: 12, color: "#94A3B8", marginTop: 1 },

  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#0F204B", marginTop: 16 },
  emptySubtitle: {
    fontSize: 14,
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 20,
  },
  emptyBtn: {
    flexDirection: "row",
    backgroundColor: "#17202b",
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 24,
  },
  emptyBtnText: { color: "#fff", fontWeight: "600", marginLeft: 8, fontSize: 15 },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#0F204B" },
  inputLabel: { fontSize: 13, fontWeight: "600", color: "#64748B", marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#0F204B",
    backgroundColor: "#F8FAFC",
  },
  relationshipRow: { marginTop: 8, marginBottom: 20 },
  relationChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    marginRight: 8,
  },
  relationChipActive: { backgroundColor: "#17202b" },
  relationChipText: { fontSize: 13, color: "#64748B", fontWeight: "500" },
  relationChipTextActive: { color: "#F4B51A" },
  saveBtn: {
    backgroundColor: "#17202b",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  badgeDot: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#DC2626",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },

  requestItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  requestAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  requestAvatarText: { fontSize: 14, fontWeight: "700", color: "#1565C0" },
  acceptBtn: {
    backgroundColor: "#16A34A",
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  rejectBtn: {
    backgroundColor: "#FEF2F2",
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
});
