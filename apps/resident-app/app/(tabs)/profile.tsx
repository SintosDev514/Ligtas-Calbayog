import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated,
  StatusBar,
  Image,
  Modal,
  StyleSheet,
} from "react-native";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../../../../shared/supabase/supabaseClient";
import { fetchResidentProfile } from "../../../../shared/services/reportService";

type MenuItemProps = {
  icon: string;
  label: string;
  sublabel?: string;
  onPress: () => void;
  dangerous?: boolean;
};

function MenuItem({
  icon,
  label,
  sublabel,
  onPress,
  dangerous,
}: MenuItemProps) {
  return (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View
        style={[styles.menuIcon, dangerous && { backgroundColor: "#FEE2E2" }]}
      >
        <Ionicons
          name={icon as any}
          size={20}
          color={dangerous ? "#DC2626" : "#0F204B"}
        />
      </View>
      <View style={styles.menuTexts}>
        <Text style={[styles.menuLabel, dangerous && { color: "#DC2626" }]}>
          {label}
        </Text>
        {sublabel ? <Text style={styles.menuSublabel}>{sublabel}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, pending: 0, resolved: 0 });
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    full_name: "",
    phone_number: "",
    address: "",
    emergency_contact: "",
    guardian_name: "",
    guardian_phone: "",
    father_name: "",
    father_phone: "",
    mother_name: "",
    mother_phone: "",
    latitude: null as number | null,
    longitude: null as number | null,
  });
  const [locating, setLocating] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    loadProfile();
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const loadProfile = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const user = session?.session?.user;
      if (!user) {
        console.warn("No user session found");
        return;
      }

      console.log("Loading profile for user:", user.id);
      setEmail(user.email ?? "");

      // Fetch profile data
      let profileData;
      try {
        profileData = await fetchResidentProfile(user.id);
        console.log("Fetched profile data:", profileData);
        if (profileData) {
          console.log("Avatar URL from database:", profileData.avatar_url);
        }
      } catch (profileError) {
        console.warn("Error fetching profile:", profileError);
        // Create empty profile if it doesn't exist
        profileData = null;
      }

      // Fetch reports data
      const { data: reportsData, error: reportsError } = await supabase
        .from("crime_reports")
        .select("status")
        .eq("resident_id", user.id);

      if (reportsError) {
        console.warn("Error fetching reports:", reportsError);
      }

      // Set profile - even if null, still set it
      setProfile(profileData || {});

      if (profileData) {
        console.log("=== PROFILE DATA RECEIVED ===");
        console.log("Full profile object:", profileData);
        console.log("Avatar URL value:", profileData.avatar_url);

        setEditForm({
          full_name: profileData.full_name || "",
          phone_number: profileData.phone_number || "",
          address: profileData.address || "",
          emergency_contact: profileData.emergency_contact || "",
          guardian_name: profileData.guardian_name || "",
          guardian_phone: profileData.guardian_phone || "",
          father_name: profileData.father_name || "",
          father_phone: profileData.father_phone || "",
          mother_name: profileData.mother_name || "",
          mother_phone: profileData.mother_phone || "",
          latitude: profileData.latitude ?? null,
          longitude: profileData.longitude ?? null,
        });
        if (profileData.avatar_url) {
          console.log("Avatar URL value from DB:", profileData.avatar_url);
          let av = profileData.avatar_url;
          // Fix double-nested "profile-photos/profile-photos/" URLs from old uploads
          if (av.includes("/profile-photos/profile-photos/")) {
            av = av.replace(
              "/profile-photos/profile-photos/",
              "/profile-photos/",
            );
          }
          if (av.startsWith("http://") || av.startsWith("https://")) {
            setProfilePhoto(av);
          } else {
            const cleanPath = av.replace(/^profile-photos\//, "");
            const { data: pub } = supabase.storage
              .from("profile-photos")
              .getPublicUrl(cleanPath);
            setProfilePhoto(pub?.publicUrl ?? null);
          }
        } else {
          console.log("✗ No avatar_url in profile data");
          setProfilePhoto(null);
        }
      } else {
        console.log("✗ Profile data is null");
        setProfilePhoto(null);
      }

      if (reportsData) {
        const all = reportsData;
        setStats({
          total: all.length,
          pending: all.filter((r: any) => r.status === "pending").length,
          resolved: all.filter((r: any) => r.status === "resolved").length,
        });
      }
    } catch (e) {
      console.error("Profile load error:", e);
      setProfile({});
    } finally {
      setIsLoading(false);
    }
  };

  const openPhotoMenu = () => {
    Alert.alert("Update Profile Photo", "Choose an option", [
      {
        text: "Take Photo",
        onPress: pickPhotoFromCamera,
      },
      {
        text: "Choose from Gallery",
        onPress: pickPhotoFromGallery,
      },
      {
        text: "Remove Photo",
        onPress: () => {
          setProfilePhoto(null);
          setProfile({ ...profile, profile_photo_url: null });
        },
        style: "destructive",
      },
      {
        text: "Cancel",
        style: "cancel",
      },
    ]);
  };

  const pickPhotoFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        await uploadProfilePhoto(result.assets[0].uri);
      }
    } catch (error) {
      console.warn("Gallery picker error", error);
      Alert.alert("Error", "Failed to pick image from gallery");
    }
  };

  const pickPhotoFromCamera = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        await uploadProfilePhoto(result.assets[0].uri);
      }
    } catch (error) {
      console.warn("Camera picker error", error);
      Alert.alert("Error", "Failed to take photo");
    }
  };

  const uploadProfilePhoto = async (photoUri: string) => {
    try {
      setIsUpdating(true);
      const { data: session } = await supabase.auth.getSession();
      const user = session?.session?.user;
      if (!user) {
        Alert.alert("Error", "User not authenticated");
        return;
      }

      const fileExt = "png";
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = fileName;

      // Upload via FormData — React Native handles file URIs natively
      const accessToken = session?.session?.access_token;
      if (!accessToken) {
        throw new Error("No access token available");
      }

      const formData = new FormData();
      formData.append("file", {
        uri: photoUri,
        type: "image/png",
        name: fileName,
      } as any);

      const uploadRes = await fetch(
        `https://rgqmuuxmucgbxrjjxsvh.supabase.co/storage/v1/object/profile-photos/${filePath}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "x-upsert": "true",
          },
          body: formData,
        },
      );

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        throw new Error(errText || "Failed to upload to storage");
      }

      const { data: publicUrlData } = supabase.storage
        .from("profile-photos")
        .getPublicUrl(filePath);

      if (!publicUrlData || !publicUrlData.publicUrl) {
        throw new Error("Failed to get public URL");
      }

      const photoUrl = publicUrlData.publicUrl;
      console.log("Generated public URL:", photoUrl);

      // Store the public URL in DB — use upsert in case profile row doesn't exist yet
      const { error: upsertError } = await supabase
        .from("resident_profiles")
        .upsert(
          {
            id: user.id,
            avatar_url: photoUrl,
          },
          { onConflict: "id" },
        );

      if (upsertError) {
        console.error("Upsert error:", upsertError);
        throw new Error(upsertError.message || "Failed to update profile");
      }

      // Display the public URL immediately (no reload needed)
      setProfilePhoto(photoUrl);
      setProfile((prev: any) => ({ ...prev, avatar_url: photoUrl }));
      Alert.alert("Success", "Profile photo updated successfully.");
    } catch (error: any) {
      console.error("Photo upload error:", error);
      const errorMessage =
        error?.message || "Failed to upload photo. Please try again.";
      Alert.alert("Upload Error", errorMessage);
    } finally {
      setIsUpdating(false);
    }
  };

  const openEditModal = () => {
    setEditForm({
      full_name: profile?.full_name || "",
      phone_number: profile?.phone_number || "",
      address: profile?.address || "",
      emergency_contact: profile?.emergency_contact || "",
      guardian_name: profile?.guardian_name || "",
      guardian_phone: profile?.guardian_phone || "",
      father_name: profile?.father_name || "",
      father_phone: profile?.father_phone || "",
      mother_name: profile?.mother_name || "",
      mother_phone: profile?.mother_phone || "",
      latitude: profile?.latitude ?? null,
      longitude: profile?.longitude ?? null,
    });
    setEditModalVisible(true);
  };

  const handleSaveProfile = async () => {
    try {
      setIsUpdating(true);
      const { data: session } = await supabase.auth.getSession();
      const user = session?.session?.user;
      if (!user) {
        Alert.alert("Error", "User not authenticated");
        return;
      }

      // Use upsert to avoid RLS violations
      const { error } = await supabase.from("resident_profiles").upsert(
        {
          id: user.id,
          ...editForm,
        },
        { onConflict: "id" },
      );

      if (error) {
        console.error("Save profile error:", error);
        throw error;
      }

      setProfile({ ...profile, ...editForm });
      setEditModalVisible(false);
      Alert.alert("Success", "Profile updated successfully");
    } catch (error: any) {
      console.error("Profile update error:", error);
      const errorMessage = error?.message || "Failed to update profile";
      Alert.alert("Error", errorMessage);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace("/(tabs)/login" as any);
        },
      },
    ]);
  };

  const initials = profile?.full_name
    ? profile.full_name
        .split(" ")
        .map((w: string) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* SIMPLE HEADER */}
      <SafeAreaView style={styles.simpleHeader}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={22} color="#0F204B" />
          </TouchableOpacity>
          <Text style={styles.simpleHeaderTitle}>My Profile</Text>
          <View style={{ width: 38 }} />
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {isLoading && (
          <View
            style={{
              alignItems: "center",
              justifyContent: "center",
              paddingTop: 100,
            }}
          >
            <ActivityIndicator size="large" color="#0F204B" />
          </View>
        )}

        {/* PROFILE CARD WITH AVATAR */}
        {!isLoading && (
          <Animated.View style={[styles.profileCard, { opacity: fadeAnim }]}>
            {/* Avatar Section */}
            <View style={styles.profileAvatarSection}>
              <TouchableOpacity
                style={styles.profileAvatarContainer}
                onPress={openPhotoMenu}
                disabled={isUpdating}
              >
                {profilePhoto ? (
                  <>
                    <Image
                      source={{ uri: profilePhoto }}
                      style={styles.profilePhotoImage}
                      onLoad={() =>
                        console.log(
                          "✓ Profile photo loaded successfully from:",
                          profilePhoto,
                        )
                      }
                      onError={(error) => {
                        console.error("✗ Failed to load profile photo");
                        console.error("URI:", profilePhoto);
                        console.error(
                          "Error:",
                          error.nativeEvent?.error || error,
                        );
                      }}
                    />
                  </>
                ) : (
                  <View style={styles.profileAvatar}>
                    <Text style={styles.profileAvatarText}>{initials}</Text>
                  </View>
                )}
                <View style={styles.photoUploadBadge}>
                  <Ionicons name="camera" size={16} color="#fff" />
                </View>
              </TouchableOpacity>
              <Text style={styles.profileFullName}>
                {profile?.full_name ?? "Resident"}
              </Text>
              <Text style={styles.profileEmailText}>{email}</Text>

              {/* Verified badge */}
              <View style={styles.profileVerifiedBadge}>
                <Ionicons
                  name="shield-checkmark"
                  size={14}
                  color="#34D399"
                  style={{ marginRight: 5 }}
                />
                <Text style={styles.profileVerifiedText}>
                  Verified Resident
                </Text>
              </View>

              {/* Edit Button */}
              <TouchableOpacity
                style={styles.editProfileBtn}
                onPress={openEditModal}
                disabled={isUpdating}
              >
                <Ionicons
                  name="pencil"
                  size={16}
                  color="#fff"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.editProfileBtnText}>Edit Profile</Text>
              </TouchableOpacity>
            </View>

            {/* Stats row */}
            <View style={styles.profileStatsRow}>
              <View style={styles.statItem}>
                <Text style={styles.profileStatValue}>{stats.total}</Text>
                <Text style={styles.profileStatLabel}>Reports</Text>
              </View>
              <View style={styles.profileStatDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.profileStatValue, { color: "#FCD34D" }]}>
                  {stats.pending}
                </Text>
                <Text style={styles.profileStatLabel}>Pending</Text>
              </View>
              <View style={styles.profileStatDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.profileStatValue, { color: "#34D399" }]}>
                  {stats.resolved}
                </Text>
                <Text style={styles.profileStatLabel}>Resolved</Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* PERSONAL INFO DETAILS CARD */}
        {!isLoading && (
          <Animated.View style={[styles.infoCard, { opacity: fadeAnim }]}>
            <Text style={styles.cardTitle}>Personal Information</Text>
            <View>
              <InfoRow
                icon="person-outline"
                label="Full Name"
                value={profile?.full_name}
              />
              <InfoRow
                icon="call-outline"
                label="Phone Number"
                value={profile?.phone_number}
              />
              <InfoRow icon="mail-outline" label="Email" value={email} />
              <InfoRow
                icon="home-outline"
                label="Address"
                value={profile?.address}
              />
              <InfoRow
                icon="people-outline"
                label="Emergency Contact"
                value={profile?.emergency_contact}
              />
              <InfoRow
                icon="shield-outline"
                label="Guardian Name"
                value={profile?.guardian_name}
              />
              <InfoRow
                icon="call-outline"
                label="Guardian Phone"
                value={profile?.guardian_phone}
              />
              <InfoRow
                icon="man-outline"
                label="Father's Name"
                value={profile?.father_name}
              />
              <InfoRow
                icon="call-outline"
                label="Father's Phone"
                value={profile?.father_phone}
              />
              <InfoRow
                icon="woman-outline"
                label="Mother's Name"
                value={profile?.mother_name}
              />
              <InfoRow
                icon="call-outline"
                label="Mother's Phone"
                value={profile?.mother_phone}
              />
            </View>
          </Animated.View>
        )}

        {/* MENU SECTION */}
        <Animated.View style={[styles.menuCard, { opacity: fadeAnim }]}>
          <Text style={styles.cardTitle}>Quick Actions</Text>
          <MenuItem
            icon="list-outline"
            label="My Reports"
            sublabel="View all submitted reports"
            onPress={() => router.push("/(tabs)/my-reports" as any)}
          />
          <MenuItem
            icon="megaphone-outline"
            label="PNP Announcements"
            sublabel="Latest advisories & news"
            onPress={() => router.push("/(tabs)/announcements" as any)}
          />
          <MenuItem
            icon="lock-closed-outline"
            label="Change Password"
            sublabel="Update your account password"
            onPress={() => router.push("/forgot-password" as any)}
          />
        </Animated.View>

        {/* APP INFO */}
        <Animated.View style={[styles.menuCard, { opacity: fadeAnim }]}>
          <Text style={styles.cardTitle}>App Info</Text>
          <MenuItem
            icon="shield-outline"
            label="About Ligtas Calbayog"
            sublabel="Version 1.0.0"
            onPress={() => {}}
          />
          <MenuItem
            icon="call-outline"
            label="Emergency Hotline"
            sublabel="PNP Calbayog: 117"
            onPress={() => {}}
          />
        </Animated.View>

        {/* LOGOUT */}
        <Animated.View style={[styles.menuCard, { opacity: fadeAnim }]}>
          <MenuItem
            icon="log-out-outline"
            label="Sign Out"
            onPress={handleLogout}
            dangerous
          />
        </Animated.View>
      </ScrollView>

      {/* EDIT PROFILE MODAL */}
      <Modal
        visible={editModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setEditModalVisible(false)}
              disabled={isUpdating}
            >
              <Ionicons name="arrow-back" size={24} color="#0F204B" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView
            style={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Full Name</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter your full name"
                value={editForm.full_name}
                onChangeText={(text) =>
                  setEditForm({ ...editForm, full_name: text })
                }
                editable={!isUpdating}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Phone Number</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter your phone number"
                value={editForm.phone_number}
                onChangeText={(text) =>
                  setEditForm({ ...editForm, phone_number: text })
                }
                keyboardType="phone-pad"
                editable={!isUpdating}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Address</Text>
              <TextInput
                style={[styles.textInput, styles.textAreaInput]}
                placeholder="Enter your address"
                value={editForm.address}
                onChangeText={(text) =>
                  setEditForm({ ...editForm, address: text })
                }
                multiline
                numberOfLines={3}
                editable={!isUpdating}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Emergency Contact</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter emergency contact"
                value={editForm.emergency_contact}
                onChangeText={(text) =>
                  setEditForm({ ...editForm, emergency_contact: text })
                }
                editable={!isUpdating}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Guardian Name</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter guardian name"
                value={editForm.guardian_name}
                onChangeText={(text) =>
                  setEditForm({ ...editForm, guardian_name: text })
                }
                editable={!isUpdating}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Guardian Phone</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter guardian phone"
                value={editForm.guardian_phone}
                onChangeText={(text) =>
                  setEditForm({ ...editForm, guardian_phone: text })
                }
                keyboardType="phone-pad"
                editable={!isUpdating}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Father's Name</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter father's name"
                value={editForm.father_name}
                onChangeText={(text) =>
                  setEditForm({ ...editForm, father_name: text })
                }
                editable={!isUpdating}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Father's Phone</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter father's phone"
                value={editForm.father_phone}
                onChangeText={(text) =>
                  setEditForm({ ...editForm, father_phone: text })
                }
                keyboardType="phone-pad"
                editable={!isUpdating}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Mother's Name</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter mother's name"
                value={editForm.mother_name}
                onChangeText={(text) =>
                  setEditForm({ ...editForm, mother_name: text })
                }
                editable={!isUpdating}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Mother's Phone</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter mother's phone"
                value={editForm.mother_phone}
                onChangeText={(text) =>
                  setEditForm({ ...editForm, mother_phone: text })
                }
                keyboardType="phone-pad"
                editable={!isUpdating}
              />
            </View>

            <View style={[styles.formGroup, { borderTopWidth: 1, borderTopColor: "#E8EEF5", paddingTop: 16, marginTop: 8 }]}>
              <Text style={[styles.formLabel, { marginBottom: 8 }]}>Your Location</Text>
              {editForm.latitude ? (
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                  <Ionicons name="location" size={16} color="#1565C0" />
                  <Text style={{ fontSize: 13, color: "#64748B", marginLeft: 6 }}>
                    {editForm.latitude.toFixed(4)}, {editForm.longitude?.toFixed(4)}
                  </Text>
                </View>
              ) : (
                <Text style={{ fontSize: 13, color: "#94A3B8", marginBottom: 8 }}>
                  No location set
                </Text>
              )}
              <TouchableOpacity
                style={{
                  flexDirection: "row", alignItems: "center", justifyContent: "center",
                  padding: 10, borderRadius: 8, borderWidth: 1, borderColor: "#DBEAFE",
                  backgroundColor: "#EFF6FF",
                }}
                onPress={async () => {
                  setLocating(true);
                  try {
                    const { status } = await Location.requestForegroundPermissionsAsync();
                    if (status !== "granted") {
                      Alert.alert("Permission Denied", "Location permission is required.");
                      return;
                    }
                    const loc = await Location.getCurrentPositionAsync({});
                    setEditForm({ ...editForm, latitude: loc.coords.latitude, longitude: loc.coords.longitude });
                  } catch (err: any) {
                    Alert.alert("Error", err.message || "Failed to get location");
                  } finally {
                    setLocating(false);
                  }
                }}
                disabled={locating}
              >
                <Ionicons name={locating ? "hourglass" : "locate"} size={16} color="#1565C0" />
                <Text style={{ marginLeft: 6, fontSize: 13, fontWeight: "600", color: "#1565C0" }}>
                  {locating ? "Getting location..." : editForm.latitude ? "Update Location" : "Set Location"}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <TouchableOpacity
                style={[styles.saveButton, isUpdating && { opacity: 0.6 }]}
                onPress={handleSaveProfile}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons
                      name="checkmark"
                      size={18}
                      color="#fff"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value?: string;
}) {
  const displayValue = value && value.trim() ? value : "Not provided";
  return (
    <View style={styles.infoRow}>
      <Ionicons
        name={icon as any}
        size={16}
        color={value && value.trim() ? "#64748B" : "#CBD5E1"}
        style={{ marginRight: 10, marginTop: 1 }}
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text
          style={[
            styles.infoValue,
            !value && { color: "#CBD5E1", fontWeight: "400" },
          ]}
        >
          {displayValue}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },
  simpleHeader: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 0,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 10,
    marginBottom: 10,
  },
  backBtn: {
    backgroundColor: "#E2E8F0",
    borderRadius: 20,
    padding: 8,
  },
  simpleHeaderTitle: { color: "#0F204B", fontSize: 17, fontWeight: "700" },
  scroll: { flex: 1 },
  profileCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 18,
    margin: 16,
    marginBottom: 12,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
  },
  profileAvatarSection: {
    alignItems: "center",
    paddingVertical: 10,
    marginBottom: 16,
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F4B51A",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 3,
    borderColor: "#E2E8F0",
  },
  profileAvatarText: { fontSize: 28, fontWeight: "800", color: "#0F204B" },
  profileFullName: { color: "#0F204B", fontSize: 20, fontWeight: "800" },
  profileEmailText: { color: "#64748B", fontSize: 13, marginTop: 4 },
  profileVerifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(52,211,153,0.15)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "rgba(52,211,153,0.3)",
  },
  profileVerifiedText: { color: "#34D399", fontSize: 12, fontWeight: "600" },
  profileStatsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  statItem: { alignItems: "center", marginHorizontal: 12 },
  profileStatValue: { color: "#0F204B", fontSize: 20, fontWeight: "800" },
  profileStatLabel: { color: "#64748B", fontSize: 11, marginTop: 3 },
  profileStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: "#E2E8F0",
  },
  infoCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 18,
    margin: 16,
    marginBottom: 0,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
  },
  infoCardScrollView: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  infoLabel: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 14,
    color: "#0F172A",
    fontWeight: "600",
    marginTop: 2,
    flexShrink: 1,
  },
  menuCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 18,
    margin: 16,
    marginBottom: 0,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC",
  },
  menuIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  menuTexts: { flex: 1 },
  menuLabel: { fontSize: 14, fontWeight: "600", color: "#0F172A" },
  menuSublabel: { fontSize: 12, color: "#94A3B8", marginTop: 2 },
  profileAvatarContainer: {
    position: "relative",
    marginBottom: 12,
  },
  profilePhotoImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: "#E2E8F0",
    backgroundColor: "#F0F4F8",
  },
  photoUploadBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#0F204B",
    borderRadius: 12,
    padding: 6,
    borderWidth: 2,
    borderColor: "#fff",
  },
  editProfileBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F204B",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 12,
  },
  editProfileBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F204B",
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F204B",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#0F172A",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  textAreaInput: {
    paddingVertical: 12,
    textAlignVertical: "top",
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F204B",
    borderRadius: 10,
    paddingVertical: 14,
    marginTop: 8,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
});
