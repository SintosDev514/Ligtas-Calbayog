import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  Alert,
  ScrollView,
  Image,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "@shared/supabase/supabaseClient";
import { colors } from "../../constants/theme";
import { profileStyles as s } from "../styles/Profile.styles";

const SUPABASE_URL = "https://rgqmuuxmucgbxrjjxsvh.supabase.co";

const INFO_ICONS: Record<string, { icon: string; color: string; bg: string }> = {
  rank: { icon: "shield-checkmark", color: "#F4B51A", bg: "#FEF9E7" },
  station: { icon: "business", color: "#3B82F6", bg: "#DBEAFE" },
  badge: { icon: "id-card", color: "#8B5CF6", bg: "#EDE9FE" },
  phone: { icon: "call", color: "#10B981", bg: "#D1FAE5" },
};

export default function ProfileScreen() {
  const { profile, signOut, refreshProfile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [localPhotoUrl, setLocalPhotoUrl] = useState<string | null>(null);

  const handleLogout = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: () => signOut(),
        },
      ],
    );
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Gallery access is required to change your profile picture.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets[0].uri) {
      await uploadPhoto(result.assets[0].uri);
    }
  };

  const uploadPhoto = async (uri: string) => {
    if (!profile?.id) return;
    setUploading(true);
    try {
      const filename = `profile-${profile.id}-${Date.now()}.jpg`;

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        Alert.alert("Error", "Not authenticated");
        return;
      }

      const formData = new FormData();
      formData.append("file", {
        uri,
        type: "image/jpeg",
        name: filename,
      } as any);

      const res = await fetch(
        `${SUPABASE_URL}/storage/v1/object/profile-photos/${filename}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "x-upsert": "true",
          },
          body: formData,
        }
      );

      if (!res.ok) {
        const text = await res.text();
        Alert.alert("Upload failed", `HTTP ${res.status}: ${text}`);
        return;
      }

      const { data: signedData, error: signedError } = await supabase.storage
        .from("profile-photos")
        .createSignedUrl(filename, 60 * 60 * 24 * 365 * 10);
      if (signedError || !signedData?.signedUrl) {
        Alert.alert("Signed URL error", signedError?.message || "No URL returned");
        return;
      }
      const photoUrl = signedData.signedUrl;

      const { error: updateError } = await supabase
        .from("police_profiles")
        .update({ photo_url: photoUrl })
        .eq("id", profile.id);
      if (updateError) {
        Alert.alert("Update failed", `Database error: ${updateError.message}`);
        return;
      }

      setLocalPhotoUrl(photoUrl);
      await refreshProfile();
      Alert.alert("Profile picture updated!");
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Something went wrong");
    } finally {
      setUploading(false);
    }
  };

  const infoRows = [
    { key: "rank", label: "Rank", value: profile?.rank, iconKey: "rank" as const },
    { key: "station", label: "Station", value: profile?.station, iconKey: "station" as const },
    { key: "badge", label: "Badge ID", value: profile?.badge_id, iconKey: "badge" as const },
    { key: "phone", label: "Phone", value: profile?.phone_number, iconKey: "phone" as const },
  ];

  const avatarUrl = localPhotoUrl || profile?.photo_url || profile?.police_id_photo_url || null;

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={["top"]} style={s.header}>
        <View style={s.headerContent}>
          <Text style={s.headerTitle}>Profile</Text>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.profileCard}>
          <Pressable onPress={pickImage} disabled={uploading}>
            <View style={s.avatarContainer}>
              {avatarUrl ? (
                <Image key={avatarUrl} source={{ uri: avatarUrl }} style={s.avatarImage} />
              ) : (
                <View style={s.avatarPlaceholder}>
                  <Ionicons name="person" size={36} color="#94A3B8" />
                </View>
              )}
              {uploading && (
                <View style={s.uploadingOverlay}>
                  <ActivityIndicator size="small" color="#fff" />
                </View>
              )}
              <View style={s.avatarOverlay}>
                <Ionicons name="camera" size={14} color="#fff" />
              </View>
            </View>
          </Pressable>
          <Text style={s.name}>{profile?.full_name || "Police Officer"}</Text>
          <Text style={s.badge}>
            {profile?.rank || "Officer"} • Badge #{profile?.badge_id || "N/A"}
          </Text>
          <View style={s.rankBadge}>
            <Ionicons name="location" size={12} color={colors.primaryLight} />
            <Text style={s.rankBadgeText}>
              {profile?.station || "Calbayog City Police Station"}
            </Text>
          </View>
        </View>

        <View style={s.infoCard}>
          {infoRows.map((row, index) => {
            const meta = INFO_ICONS[row.iconKey];
            const isLast = index === infoRows.length - 1;
            return (
              <View key={row.key} style={[s.infoRow, isLast && s.infoRowLast]}>
                <View style={[s.infoIcon, { backgroundColor: meta.bg }]}>
                  <Ionicons name={meta.icon as any} size={18} color={meta.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.infoLabel}>{row.label}</Text>
                  <Text style={s.infoValue}>{row.value || "N/A"}</Text>
                </View>
              </View>
            );
          })}
        </View>

        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out" size={18} color="#DC2626" />
          <Text style={s.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <View style={s.footer} />
      </ScrollView>
    </View>
  );
}
