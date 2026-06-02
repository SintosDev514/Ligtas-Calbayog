import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  Alert,
  ScrollView,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import { colors } from "../../constants/theme";
import { profileStyles as s } from "../styles/Profile.styles";

const INFO_ICONS: Record<string, { icon: string; color: string; bg: string }> = {
  rank: { icon: "shield-checkmark", color: "#F4B51A", bg: "#FEF9E7" },
  station: { icon: "business", color: "#3B82F6", bg: "#DBEAFE" },
  badge: { icon: "id-card", color: "#8B5CF6", bg: "#EDE9FE" },
  phone: { icon: "call", color: "#10B981", bg: "#D1FAE5" },
};

export default function ProfileScreen() {
  const { profile, signOut } = useAuth();

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

  const infoRows = [
    { key: "rank", label: "Rank", value: profile?.rank, iconKey: "rank" as const },
    { key: "station", label: "Station", value: profile?.station, iconKey: "station" as const },
    { key: "badge", label: "Badge ID", value: profile?.badge_id, iconKey: "badge" as const },
    { key: "phone", label: "Phone", value: profile?.phone || profile?.phone_number, iconKey: "phone" as const },
  ];

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
          <View style={s.avatarContainer}>
            {profile?.photo_url ? (
              <Image source={{ uri: profile.photo_url }} style={s.avatarImage} />
            ) : (
              <View style={s.avatarPlaceholder}>
                <Ionicons name="person" size={36} color="#94A3B8" />
              </View>
            )}
          </View>
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
