import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  Image,
  TouchableOpacity,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../../../shared/supabase/supabaseClient";
import { statusColors } from "../../constants/theme";
import { residentProfileStyles as s } from "../styles/ResidentProfile.styles";
import MapView, { Marker } from "../../components/MapView";

export default function ResidentProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [resident, setResident] = useState<any>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    loadResident();
  }, [id]);

  const loadResident = async () => {
    try {
      setLoading(true);
      const [residentData, reportsData, userData] = await Promise.all([
        supabase.from("resident_profiles").select("*").eq("id", id).single(),
        supabase
          .from("crime_reports")
          .select("*")
          .eq("resident_id", id)
          .order("created_at", { ascending: false }),
        supabase.from("users").select("email").eq("id", id).maybeSingle(),
      ]);
      if (residentData.data) {
        setResident({ ...residentData.data, email: userData.data?.email || null });
      }
      if (reportsData.data) setReports(reportsData.data);
    } catch (err) {
      console.error("Failed to load resident:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const openLocation = () => {
    if (!resident?.latitude || !resident?.longitude) return;
    const url = `https://www.google.com/maps?q=${resident.latitude},${resident.longitude}`;
    Linking.openURL(url);
  };

  if (loading) {
    return (
      <View style={s.loadingContainer}>
        <ActivityIndicator size="large" color="#17202b" />
      </View>
    );
  }

  if (!resident) {
    return (
      <View style={s.errorContainer}>
        <Ionicons name="person" size={48} color="#CBD5E1" />
        <Text style={s.errorText}>Resident not found</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={["top"]} style={s.header}>
        <View style={s.headerContent}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Resident Profile</Text>
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={s.heroSection}>
          <View style={s.heroAvatar}>
            {(resident.avatar_url || resident.photo_url) ? (
              <Image source={{ uri: resident.avatar_url || resident.photo_url }} style={s.heroAvatarImage} />
            ) : (
              <Ionicons name="person" size={40} color="#94A3B8" />
            )}
          </View>
          <Text style={s.heroName}>{resident.full_name || "Unknown"}</Text>
          <Text style={s.heroAddress}>{resident.address || "No address"}</Text>
          {resident.latitude && (
            <TouchableOpacity style={s.heroLocation} onPress={openLocation}>
              <Ionicons name="location" size={16} color="#3B82F6" />
              <Text style={s.heroLocationText}>
                {resident.latitude.toFixed(4)}, {resident.longitude.toFixed(4)}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={s.contentSection}>
          <View style={s.infoCard}>
            <Text style={s.infoCardTitle}>Contact Information</Text>
            <View style={s.infoRow}>
              <Ionicons name="call" size={16} color="#64748B" />
              <Text style={s.infoRowText}>
                {resident.emergency_contact || "No emergency contact"}
              </Text>
            </View>
            <View style={s.infoRow}>
              <Ionicons name="mail" size={16} color="#64748B" />
              <Text style={s.infoRowText}>
                {resident.email || "No email on file"}
              </Text>
            </View>
            {resident.id_photo_url && (
              <TouchableOpacity style={s.infoRow} onPress={() => Linking.openURL(resident.id_photo_url)}>
                <Ionicons name="id-card" size={16} color="#64748B" />
                <Text style={[s.infoRowText, { color: "#3B82F6", textDecorationLine: "underline" }]}>
                  View ID Photo
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={s.reportsCard}>
            <Text style={s.reportsCardTitle}>
              Reports Filed ({reports.length})
            </Text>
            {reports.length === 0 ? (
              <Text style={s.emptyReportsText}>
                No reports filed by this resident.
              </Text>
            ) : (
              reports.map((r) => {
                const sc = statusColors[r.status] || statusColors.pending;
                return (
                  <View key={r.id} style={s.reportItem}>
                    <View style={[s.reportIcon, { backgroundColor: sc.bg }]}>
                      <Ionicons
                        name={sc.icon as any}
                        size={18}
                        color={sc.text}
                      />
                    </View>
                    <View style={s.reportInfo}>
                      <Text style={s.reportType}>
                        {r.crime_type?.replace("-", " ") || "Report"}
                      </Text>
                      <Text style={s.reportMeta}>
                        {formatDate(r.created_at)} •{" "}
                        {r.location_address || "No location"}
                      </Text>
                    </View>
                    <View style={[s.reportStatusBadge, { backgroundColor: sc.bg }]}>
                      <Text style={[s.reportStatusText, { color: sc.text }]}>
                        {r.status?.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {resident.latitude && (
            <View style={s.mapContainer}>
              <MapView
                style={{ flex: 1 }}
                initialRegion={{
                  latitude: resident.latitude,
                  longitude: resident.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
                scrollEnabled={false}
                zoomEnabled={false}
              >
                <Marker
                  coordinate={{
                    latitude: resident.latitude,
                    longitude: resident.longitude,
                  }}
                  pinColor="#22C55E"
                  title={resident.full_name}
                >
                  {(resident.avatar_url || resident.photo_url) ? (
                    <Image
                      source={{ uri: resident.avatar_url || resident.photo_url }}
                      style={{ width: 28, height: 28, borderRadius: 14 }}
                    />
                  ) : null}
                </Marker>
              </MapView>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
