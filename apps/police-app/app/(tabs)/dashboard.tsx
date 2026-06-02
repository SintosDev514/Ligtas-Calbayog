import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Image,
  Modal,
  ScrollView,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { supabase } from "../../../../shared/supabase/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import { statusColors } from "../../constants/theme";
import { dashboardStyles as s } from "../styles/Dashboard.styles";
import MapView, { Marker } from "../../components/MapView";

export default function DashboardScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [residents, setResidents] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterMap, setFilterMap] = useState<"all" | "emergency">("all");
  const [selectedResident, setSelectedResident] = useState<any | null>(null);

  useEffect(() => {
    loadData();
    const channel = supabase
      .channel("police-dashboard")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "crime_reports" },
        () => loadData(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "crime_reports" },
        () => loadData(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [residentData, reportsData] = await Promise.all([
        supabase.from("resident_profiles").select("*"),
        supabase
          .from("crime_reports")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);
      if (residentData.error) throw residentData.error;
      if (reportsData.error) throw reportsData.error;
      console.log("Residents loaded:", residentData.data?.length, "Reports loaded:", reportsData.data?.length);
      setResidents(residentData.data || []);
      setReports(reportsData.data || []);
    } catch (err: any) {
      console.error("Failed to load data:", err);
      setError(err?.message || "Failed to load data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const pendingReports = reports.filter((r) => r.status === "pending").length;
  const totalResidents = residents.length;
  const residentsWithLocation = residents.filter((r) => r.latitude).length;

  const residentReportIds = useMemo(
    () => new Set(reports.map((r) => r.resident_id)),
    [reports],
  );

  const allResidentsWithLocation = residents.filter(
    (r) => r.latitude && r.longitude,
  );
  const emergencyResidents = allResidentsWithLocation.filter((r) =>
    residentReportIds.has(r.id),
  );

  const visibleResidents =
    filterMap === "emergency" ? emergencyResidents : allResidentsWithLocation;
  const reportsWithLocation = reports.filter(
    (r) => r.latitude && r.longitude,
  );

  const centerLat =
    allResidentsWithLocation.length > 0
      ? allResidentsWithLocation.reduce((s, r) => s + r.latitude, 0) /
        allResidentsWithLocation.length
      : 12.061;
  const centerLng =
    allResidentsWithLocation.length > 0
      ? allResidentsWithLocation.reduce((s, r) => s + r.longitude, 0) /
        allResidentsWithLocation.length
      : 124.596;

  const getResidentPopupHtml = (resident: any) => {
    const residentReports = reports.filter((r) => r.resident_id === resident.id);
    const profilePic = resident.avatar_url || resident.photo_url;
    const photo = profilePic
      ? `<img src="${profilePic}" style="width:44px;height:44px;border-radius:22px;object-fit:cover;border:2px solid #22C55E;" />`
      : `<div style="width:44px;height:44px;border-radius:22px;background:#E2E8F0;display:flex;align-items:center;justify-content:center;font-size:18px;color:#94A3B8;">👤</div>`;
    return `
      <div style="font-family:sans-serif;min-width:200px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
          ${photo}
          <div>
            <div style="font-weight:700;font-size:15px;color:#0F172A;">${resident.full_name || "Unknown"}</div>
            <div style="font-size:11px;color:#64748B;margin-top:2px;">${resident.address || "No address"}</div>
          </div>
        </div>
        <div style="font-size:12px;color:#475569;border-top:1px solid #F1F5F9;padding-top:6px;">
          <div>📋 ${residentReports.length} report(s) filed</div>
          ${resident.emergency_contact ? `<div>📞 Emergency: ${resident.emergency_contact}</div>` : ""}
        </div>
      </div>
    `;
  };

  const handleMarkerPress = (markerData: any) => {
    const resident = visibleResidents.find(
      (r) =>
        r.latitude === markerData.coordinate.latitude &&
        r.longitude === markerData.coordinate.longitude,
    );
    if (resident) {
      setSelectedResident(resident);
    }
  };

  const renderResidentMarker = (resident: any) => (
    <Marker
      key={`r-${resident.id}`}
      coordinate={{
        latitude: resident.latitude,
        longitude: resident.longitude,
      }}
      pinColor="#22C55E"
      popupHtml={getResidentPopupHtml(resident)}
    >
      {(resident.avatar_url || resident.photo_url) ? (
        <Image
          source={{ uri: resident.avatar_url || resident.photo_url }}
          style={{ width: 28, height: 28, borderRadius: 14 }}
        />
      ) : null}
    </Marker>
  );

  const renderReportMarker = (report: any) => (
    <Marker
      key={`p-${report.id}`}
      coordinate={{
        latitude: report.latitude,
        longitude: report.longitude,
      }}
      title={`${report.crime_type?.replace("-", " ") || "Report"}\n${
        report.location_address || ""
      }`}
      pinColor={statusColors[report.status] || "#64748B"}
    />
  );

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={["top"]} style={s.header}>
        <View style={s.headerContent}>
          <Text style={s.headerTitle}>Dashboard</Text>
          <View style={s.headerBadge}>
            <Ionicons name="shield-checkmark" size={14} color="#F4B51A" />
            <Text style={s.headerBadgeText}>
              {profile?.badge_id || "ON DUTY"}
            </Text>
          </View>
        </View>
      </SafeAreaView>

      <View style={s.statsRow}>
        <View style={s.statCard}>
          <Text style={[s.statValue, { color: "#3B82F6" }]}>
            {totalResidents}
          </Text>
          <Text style={s.statLabel}>Total Residents</Text>
        </View>
        <View style={s.statCard}>
          <Text style={[s.statValue, { color: "#F59E0B" }]}>
            {pendingReports}
          </Text>
          <Text style={s.statLabel}>Pending Reports</Text>
        </View>
        <View style={s.statCard}>
          <Text style={[s.statValue, { color: "#10B981" }]}>
            {reports.length}
          </Text>
          <Text style={s.statLabel}>Total Reports</Text>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color="#17202b" />
        </View>
      ) : error ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 24 }}>
          <Ionicons name="cloud-offline" size={48} color="#94A3B8" />
          <Text style={{ fontSize: 16, color: "#64748B", textAlign: "center", marginTop: 12, marginBottom: 20 }}>
            {error}
          </Text>
          <TouchableOpacity
            onPress={loadData}
            style={{
              backgroundColor: "#17202b",
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 10,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={s.mapContainer}>
          <View style={s.mapFilterRow}>
            <TouchableOpacity
              style={[
                s.mapFilterBtn,
                filterMap === "all" && s.mapFilterBtnActive,
              ]}
              onPress={() => setFilterMap("all")}
            >
              <Ionicons
                name="people"
                size={14}
                color={filterMap === "all" ? "#fff" : "#64748B"}
              />
              <Text
                style={[
                  s.mapFilterText,
                  filterMap === "all" && s.mapFilterTextActive,
                ]}
              >
                All ({allResidentsWithLocation.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                s.mapFilterBtn,
                filterMap === "emergency" && s.mapFilterBtnActive,
              ]}
              onPress={() => setFilterMap("emergency")}
            >
              <Ionicons
                name="alert-circle"
                size={14}
                color={filterMap === "emergency" ? "#fff" : "#EF4444"}
              />
              <Text
                style={[
                  s.mapFilterText,
                  filterMap === "emergency" && s.mapFilterTextActive,
                ]}
              >
                Emergency ({emergencyResidents.length})
              </Text>
            </TouchableOpacity>
          </View>
          <MapView
            style={{ flex: 1, borderRadius: 16 }}
            initialRegion={{
              latitude: centerLat,
              longitude: centerLng,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
            showsUserLocation
            scrollEnabled
            zoomEnabled
            onMarkerPress={handleMarkerPress}
          >
            {visibleResidents.map(renderResidentMarker)}
            {reportsWithLocation.map(renderReportMarker)}
          </MapView>
        </View>
      )}

      <Modal
        visible={!!selectedResident}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedResident(null)}
      >
        <TouchableOpacity
          style={s.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedResident(null)}
        >
          <TouchableOpacity
            style={s.modalContent}
            activeOpacity={1}
            onPress={() => {}}
          >
            {selectedResident && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={s.modalHeader}>
                  <View style={s.modalAvatar}>
                    {(selectedResident.avatar_url || selectedResident.photo_url) ? (
                      <Image
                        source={{ uri: selectedResident.avatar_url || selectedResident.photo_url }}
                        style={s.modalAvatarImage}
                      />
                    ) : (
                      <Ionicons name="person" size={32} color="#94A3B8" />
                    )}
                  </View>
                  <Text style={s.modalName}>
                    {selectedResident.full_name || "Unknown"}
                  </Text>
                  <Text style={s.modalBadge}>
                    {selectedResident.address || "No address on file"}
                  </Text>
                </View>

                <View style={s.modalInfoRow}>
                  <Ionicons name="call" size={16} color="#64748B" />
                  <Text style={s.modalInfoText}>
                    {selectedResident.emergency_contact || "No emergency contact"}
                  </Text>
                </View>

                {selectedResident.id_photo_url && (
                  <TouchableOpacity
                    style={s.modalInfoRow}
                    onPress={() => Linking.openURL(selectedResident.id_photo_url)}
                  >
                    <Ionicons name="id-card" size={16} color="#64748B" />
                    <Text style={[s.modalInfoText, { color: "#3B82F6", textDecorationLine: "underline" }]}>
                      View ID Photo
                    </Text>
                  </TouchableOpacity>
                )}

                {selectedResident.latitude && (
                  <View style={s.modalInfoRow}>
                    <Ionicons name="location" size={16} color="#64748B" />
                    <Text style={s.modalInfoText}>
                      {selectedResident.latitude.toFixed(4)},{" "}
                      {selectedResident.longitude.toFixed(4)}
                    </Text>
                  </View>
                )}

                <View style={s.modalDivider} />

                <Text style={s.modalSectionTitle}>Recent Reports</Text>
                {reports
                  .filter((r) => r.resident_id === selectedResident.id)
                  .slice(0, 3)
                  .map((r) => (
                    <View key={r.id} style={s.modalReportItem}>
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor:
                            statusColors[r.status] || "#64748B",
                        }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={s.modalReportType}>
                          {r.crime_type?.replace("-", " ") || "Report"}
                        </Text>
                        <Text style={s.modalReportDate}>
                          {new Date(r.created_at).toLocaleDateString("en-PH", {
                            month: "short",
                            day: "numeric",
                          })}
                        </Text>
                      </View>
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: "600",
                          color: statusColors[r.status] || "#64748B",
                        }}
                      >
                        {r.status?.toUpperCase()}
                      </Text>
                    </View>
                  ))}

                {reports.filter((r) => r.resident_id === selectedResident.id)
                  .length === 0 && (
                  <Text style={s.modalEmptyText}>
                    No reports filed by this resident.
                  </Text>
                )}

                <TouchableOpacity
                  style={s.modalProfileBtn}
                  onPress={() => {
                    setSelectedResident(null);
                    router.push(
                      `/resident/${selectedResident.id}` as any,
                    );
                  }}
                >
                  <Ionicons name="person" size={16} color="#fff" />
                  <Text style={s.modalProfileBtnText}>View Full Profile</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
