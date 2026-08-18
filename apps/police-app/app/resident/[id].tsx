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
  Platform,
  Alert,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "@shared/supabase/supabaseClient";
import { statusColors, colors } from "../../constants/theme";
import { residentProfileStyles as s } from "../styles/ResidentProfile.styles";
import MapView, { Marker } from "../../components/MapView";
import { openBestStreetView } from "@shared/utils/streetView";

export default function ResidentProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [resident, setResident] = useState<any>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<any | null>(null);

  useEffect(() => {
    if (!id) return;
    loadResident();

    const channel = supabase
      .channel(`resident-reports-${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "crime_reports", filter: `resident_id=eq.${id}` },
        () => loadResident(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "crime_reports", filter: `resident_id=eq.${id}` },
        () => loadResident(),
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
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

  const openNavigation = (lat: number, lng: number) => {
    const url =
      Platform.OS === "ios"
        ? `maps://app?daddr=${lat},${lng}`
        : `geo:${lat},${lng}?q=${lat},${lng}`;
    Linking.openURL(url).catch(() =>
      Alert.alert("Error", "Could not open navigation app."),
    );
  };

  const openStreetView = () => {
    if (!resident?.latitude || !resident?.longitude) return;
    openBestStreetView(resident.latitude, resident.longitude, Linking);
  };

  const getEvidenceUrls = (photoUrl: string | null) => {
    if (!photoUrl) return [];
    return photoUrl.split(",").map((u) => u.trim()).filter(Boolean);
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
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.borderLight, justifyContent: "center", alignItems: "center", marginBottom: 16 }}>
          <Ionicons name="person" size={36} color="#CBD5E1" />
        </View>
        <Text style={s.errorText}>Resident not found</Text>
      </View>
    );
  }

  const hasEmail = !!resident.email;
  const hasIdPhoto = !!resident.id_photo_url;

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
          <View style={s.heroCover}>
            <View style={s.heroCoverAccent} />
            <View style={s.heroCoverAccent2} />
            <View style={s.heroAvatarWrap}>
              <View style={s.heroAvatar}>
                {(resident.avatar_url || resident.photo_url) ? (
                  <Image source={{ uri: resident.avatar_url || resident.photo_url }} style={s.heroAvatarImage} />
                ) : (
                  <Ionicons name="person" size={40} color="#94A3B8" />
                )}
              </View>
            </View>
            <Text style={s.heroName}>{resident.full_name || "Unknown"}</Text>
            <View style={s.heroBadge}>
              <Ionicons name="shield-checkmark" size={14} color="#F4B51A" />
              <Text style={s.heroBadgeText}>Verified Resident</Text>
            </View>
          </View>
        </View>

        <View style={s.contentSection}>
          <View style={s.sectionCard}>
            <View style={s.sectionCardHeader}>
              <Text style={s.sectionCardTitle}>Reports Filed</Text>
              <View style={s.sectionCardBadge}>
                <Text>{reports.length}</Text>
              </View>
            </View>
            {reports.length === 0 ? (
              <Text style={s.emptyReportsText}>
                No reports filed by this resident.
              </Text>
            ) : (
              reports.map((r) => {
                const sc = statusColors[r.status] || statusColors.pending;
                return (
                  <TouchableOpacity key={r.id} style={s.reportItem} activeOpacity={0.6} onPress={() => setSelectedReport(r)}>
                    <View style={[s.reportIcon, { backgroundColor: sc.bg }]}>
                      <Ionicons
                        name={sc.icon as any}
                        size={18}
                        color={sc.text}
                      />
                    </View>
                    <View style={s.reportInfo}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text style={s.reportType} numberOfLines={1}>
                          {r.crime_type?.replace("-", " ") || "Report"}
                        </Text>
                      </View>
                      <Text style={s.reportMeta}>
                        {formatDate(r.created_at)}
                      </Text>
                    </View>
                    <View style={[s.reportStatusBadge, { backgroundColor: sc.bg }]}>
                      <Text style={[s.reportStatusText, { color: sc.text }]}>
                        {r.status?.toUpperCase()}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          <View style={s.sectionCard}>
            <View style={s.sectionCardHeader}>
              <Text style={s.sectionCardTitle}>Account Information</Text>
              <Ionicons name="person-circle" size={20} color="#94A3B8" />
            </View>
            <View style={s.infoRow}>
              <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: "#EEF2FF", justifyContent: "center", alignItems: "center" }}>
                <Ionicons name="mail" size={16} color="#4F46E5" />
              </View>
              <Text style={s.infoRowText}>
                {resident.email || "No email on file"}
              </Text>
            </View>
            {hasIdPhoto && (
              <TouchableOpacity style={s.infoRow} onPress={() => Linking.openURL(resident.id_photo_url)}>
                <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: "#FEF3C7", justifyContent: "center", alignItems: "center" }}>
                  <Ionicons name="id-card" size={16} color="#D97706" />
                </View>
                <Text style={s.infoRowText}>ID Photo</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Image source={{ uri: resident.id_photo_url }} style={{ width: 32, height: 32, borderRadius: 6 }} resizeMode="cover" />
                  <Ionicons name="open-outline" size={14} color="#3B82F6" />
                </View>
              </TouchableOpacity>
            )}
          </View>

          <View style={s.sectionCard}>
            <View style={s.sectionCardHeader}>
              <Text style={s.sectionCardTitle}>Contact & Location</Text>
              <Ionicons name="location" size={18} color="#94A3B8" />
            </View>
            <View style={s.infoRow}>
              <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: "#EEF2FF", justifyContent: "center", alignItems: "center" }}>
                <Ionicons name="home" size={16} color="#4F46E5" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: "#94A3B8", fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 }}>Address</Text>
                <Text style={{ fontSize: 13, color: "#0F172A", fontWeight: "600", marginTop: 1 }} numberOfLines={1}>
                  {resident.address || "No address"}
                </Text>
              </View>
            </View>
            <View style={s.infoRow}>
              <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: "#FEF3C7", justifyContent: "center", alignItems: "center" }}>
                <Ionicons name="call" size={16} color="#D97706" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: "#94A3B8", fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 }}>Emergency Contact</Text>
                <Text style={{ fontSize: 13, color: "#0F172A", fontWeight: "600", marginTop: 1 }}>
                  {resident.emergency_contact || "N/A"}
                </Text>
              </View>
            </View>
            {resident.latitude && (
              <TouchableOpacity style={s.infoRow} onPress={openLocation}>
                <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: "#EEF2FF", justifyContent: "center", alignItems: "center" }}>
                  <Ionicons name="location" size={16} color="#4F46E5" />
                </View>
                <Text style={s.infoRowText}>
                  {resident.latitude.toFixed(4)}, {resident.longitude.toFixed(4)}
                </Text>
                <Ionicons name="open-outline" size={14} color="#3B82F6" />
              </TouchableOpacity>
            )}
            {resident.latitude && (
              <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: "#F1F5F9" }}>
                <TouchableOpacity
                  style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#DCFCE7", paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: "#DCFCE7" }}
                  onPress={() => {
                    if (resident.emergency_contact) {
                      Linking.openURL(`tel:${resident.emergency_contact.replace(/[^0-9+]/g, "")}`);
                    }
                  }}
                >
                  <Ionicons name="call" size={16} color="#16A34A" />
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#16A34A" }}>Call</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#DBEAFE", paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: "#DBEAFE" }}
                  onPress={openStreetView}
                >
                  <Ionicons name="eye" size={16} color="#2563EB" />
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#2563EB" }}>Street View</Text>
                </TouchableOpacity>
              </View>
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
                  pinColor="#10B981"
                />
              </MapView>
            </View>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={!!selectedReport}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedReport(null)}
      >
        <View style={s.modalOverlay}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setSelectedReport(null)}
          />
          <View style={s.modalContent}>
            {selectedReport && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={s.modalHandle} />
                <View style={s.modalHeaderRow}>
                  <View style={[s.modalBadge, { backgroundColor: (statusColors[selectedReport.status] || statusColors.pending).bg }]}>
                    <Ionicons
                      name={(statusColors[selectedReport.status] || statusColors.pending).icon as any}
                      size={14}
                      color={(statusColors[selectedReport.status] || statusColors.pending).text}
                    />
                    <Text style={[s.modalBadgeText, { color: (statusColors[selectedReport.status] || statusColors.pending).text }]}>
                      {selectedReport.status?.toUpperCase()}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedReport(null)}>
                    <Ionicons name="close" size={22} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <Text style={s.modalTitle}>
                  {selectedReport.crime_type
                    ?.split("-")
                    .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
                    .join(" ") || "Report"}
                </Text>

                <View style={s.modalResidentRow}>
                  {resident?.avatar_url || resident?.photo_url ? (
                    <Image
                      source={{ uri: resident.avatar_url || resident.photo_url }}
                      style={s.modalResidentPhoto}
                    />
                  ) : (
                    <View style={[s.modalResidentPhoto, { backgroundColor: "#F1F5F9", justifyContent: "center", alignItems: "center" }]}>
                      <Ionicons name="person" size={18} color="#94A3B8" />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={s.modalResidentName}>
                      {resident?.full_name || "Unknown Resident"}
                    </Text>
                    <Text style={s.modalDate}>{formatDate(selectedReport.created_at)}</Text>
                  </View>
                </View>

                <Text style={s.modalSectionLabel}>Description</Text>
                <Text style={s.modalDescription}>
                  {selectedReport.description || "No description provided."}
                </Text>

                {selectedReport.location_address && (
                  <>
                    <Text style={s.modalSectionLabel}>Location</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}>
                      <Ionicons name="location" size={16} color="#3B82F6" />
                      <Text style={{ fontSize: 13, color: "#475569", flex: 1 }}>
                        {selectedReport.location_address}
                      </Text>
                      {selectedReport.latitude && (
                        <TouchableOpacity
                          onPress={() => openNavigation(selectedReport.latitude, selectedReport.longitude)}
                          style={{ backgroundColor: "#DBEAFE", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: "700", color: "#2563EB" }}>Navigate</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </>
                )}

                {selectedReport.latitude && (
                  <View style={s.modalMapContainer}>
                    <MapView
                      style={{ flex: 1 }}
                      initialRegion={{
                        latitude: selectedReport.latitude,
                        longitude: selectedReport.longitude,
                        latitudeDelta: 0.01,
                        longitudeDelta: 0.01,
                      }}
                      scrollEnabled={false}
                      zoomEnabled={false}
                    >
                      <Marker
                        coordinate={{ latitude: selectedReport.latitude, longitude: selectedReport.longitude }}
                        pinColor={(statusColors[selectedReport.status] || statusColors.pending).text}
                      />
                    </MapView>
                  </View>
                )}

                {getEvidenceUrls(selectedReport.photo_url).length > 0 && (
                  <>
                    <Text style={s.modalSectionLabel}>
                      Evidence ({getEvidenceUrls(selectedReport.photo_url).length})
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.modalEvidenceRow}>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        {getEvidenceUrls(selectedReport.photo_url).map((url: string, idx: number) => (
                          <Image
                            key={idx}
                            source={{ uri: url }}
                            style={s.modalEvidenceImage}
                            resizeMode="cover"
                          />
                        ))}
                      </View>
                    </ScrollView>
                  </>
                )}

                <View style={{ height: 20 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
