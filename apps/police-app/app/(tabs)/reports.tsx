import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
  Modal,
  ScrollView,
  Image,
  Vibration,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { supabase } from "../../../../shared/supabase/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import { useAlarm } from "../../context/AlarmContext";
import { statusColors, crimeIcons, colors } from "../../constants/theme";
import { reportsStyles as s } from "../styles/Reports.styles";
import MapView, { Marker } from "../../components/MapView";
import { upsertPoliceLocation } from "../../../../shared/services/reportService";

export default function ReportsScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const { alertBanner, setAlertBanner, playEmergencyAlert, stopAlertForReport, stopAllAlarms } = useAlarm();
  const [reports, setReports] = useState<any[]>([]);
  const [residents, setResidents] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [policeLocation, setPoliceLocation] = useState<{latitude: number; longitude: number} | null>(null);
  const locationWatchRef = useRef<any>(null);
  const locationIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    loadReports();
    const channel = supabase
      .channel("police-reports")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "crime_reports" },
        (payload) => {
          const newReport = payload.new as any;
          setReports((prev) => [newReport, ...prev]);
          if (newReport.resident_id) {
            loadResidentName(newReport.resident_id);
          }
          playEmergencyAlert(newReport);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "crime_reports" },
        (payload) => {
          const updated = payload.new as any;
          if (updated.status === "in-progress" || updated.status === "resolved" || updated.status === "dismissed") {
            stopAlertForReport(updated.id);
          }
          if (updated.status === "pending") {
            playEmergencyAlert(updated);
          }
          setReports((prev) =>
            prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)),
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      try { Vibration.cancel(); } catch (_) {}
    };
  }, []);

  const reportsInitialDone = useRef(false);
  useEffect(() => {
    if (!reportsInitialDone.current) {
      reportsInitialDone.current = true;
      for (const r of reports) {
        if (r.status === "pending") {
          playEmergencyAlert(r);
        }
      }
    }
  }, [reports]);

  // Start/stop location tracking based on active report
  useEffect(() => {
    if (!activeReportId) {
      if (locationWatchRef.current) { locationWatchRef.current.remove?.(); locationWatchRef.current = null; }
      if (locationIntervalRef.current) { clearInterval(locationIntervalRef.current); locationIntervalRef.current = null; }
      setPoliceLocation(null);
      return;
    }

    const startTracking = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;

        locationWatchRef.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 0 },
          (pos) => {
            const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
            setPoliceLocation(loc);
          },
        );
      } catch (err) {
        console.warn("Location watch failed:", err);
        if (!navigator.geolocation) return;
        const watchId = navigator.geolocation.watchPosition(
          (pos) => setPoliceLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
          (err) => console.warn("Geolocation error:", err.message),
          { enableHighAccuracy: true },
        );
        locationWatchRef.current = { remove: () => navigator.geolocation.clearWatch(watchId) };
      }
    };

    startTracking();

    return () => {
      if (locationWatchRef.current) { locationWatchRef.current.remove?.(); locationWatchRef.current = null; }
      if (locationIntervalRef.current) { clearInterval(locationIntervalRef.current); locationIntervalRef.current = null; }
    };
  }, [activeReportId]);

  // Upsert police location to DB every 5 seconds when active
  useEffect(() => {
    if (!activeReportId || !policeLocation || !profile) return;

    const upsert = () => {
      upsertPoliceLocation(profile.id, activeReportId, policeLocation.latitude, policeLocation.longitude)
        .catch((err) => console.warn("Failed to upsert police location:", err.message));
    };

    upsert();
    const id = setInterval(upsert, 5000);
    locationIntervalRef.current = id;

    return () => clearInterval(id);
  }, [activeReportId, policeLocation, profile]);

  const loadResidentName = async (residentId: string) => {
    if (residents[residentId]) return;
    const { data } = await supabase
      .from("resident_profiles")
      .select("id, full_name, avatar_url, photo_url, address, emergency_contact")
      .eq("id", residentId)
      .single();
    if (data) {
      setResidents((prev) => ({ ...prev, [data.id]: data }));
    }
  };

  const loadReports = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("crime_reports")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setReports(data || []);

      const ids = [...new Set((data || []).map((r: any) => r.resident_id))];
      if (ids.length > 0) {
        const { data: resData, error: resError } = await supabase
          .from("resident_profiles")
          .select("id, full_name, avatar_url, photo_url, address, emergency_contact")
          .in("id", ids);
        if (resError) throw resError;
        const map: Record<string, any> = {};
        (resData || []).forEach((r: any) => (map[r.id] = r));
        setResidents(map);
      }
    } catch (err: any) {
      console.error("Failed to load reports:", err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (reportId: string, status: string) => {
    try {
      const updateData: any = { status, updated_at: new Date().toISOString() };
      if (status === "in-progress" && profile?.id) {
        updateData.assigned_officer_id = profile.id;
      }
      const { error } = await supabase
        .from("crime_reports")
        .update(updateData)
        .eq("id", reportId);
      if (error) throw error;
      setReports((prev) =>
        prev.map((r) => r.id === reportId ? { ...r, status } : r),
      );
      if (selectedReport?.id === reportId) {
        setSelectedReport((prev: any) => prev ? { ...prev, status } : null);
      }

      if (status === "in-progress") {
        setActiveReportId(reportId);
        stopAllAlarms();
      } else if (status === "resolved" || status === "dismissed") {
        if (activeReportId === reportId) setActiveReportId(null);
        stopAllAlarms();
      }

      Alert.alert("Updated", `Report marked as "${status.replace("-", " ")}".`);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  const navigateToRoute = async (destLat: number, destLng: number, residentId: string) => {
    if (!destLat || !destLng) {
      Alert.alert("Error", "This report has no location data.");
      return;
    }
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Location access is required for navigation.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const params = new URLSearchParams({
        sourceLat: pos.coords.latitude.toString(),
        sourceLng: pos.coords.longitude.toString(),
        destLat: destLat.toString(),
        destLng: destLng.toString(),
        name: residents[residentId]?.full_name || "Resident",
      });
      router.push(`/navigate/${residentId}?${params.toString()}` as any);
    } catch (err) {
      Alert.alert("Error", "Could not get your current location. Make sure GPS is enabled.");
    }
  };

  const filteredReports = reports.filter((r) => {
    if (filter === "all") return true;
    return r.status === filter;
  });

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getEvidenceUrls = (photoUrl: string | null) => {
    if (!photoUrl) return [];
    return photoUrl.split(",").map((u) => u.trim()).filter(Boolean);
  };

  const renderReportCard = (item: any) => {
    const status = item.status?.toLowerCase() || "pending";
    const meta = statusColors[status] || statusColors.pending;
    const icon = crimeIcons[item.crime_type] || "alert-circle";
    const resident = residents[item.resident_id];

    return (
      <TouchableOpacity
        key={item.id}
        activeOpacity={0.7}
        onPress={() => setSelectedReport(item)}
        style={s.card}
      >
        <View style={s.cardHeader}>
          <View style={[s.cardIcon, { backgroundColor: meta.bg }]}>
            <Ionicons name={icon as any} size={20} color={meta.text} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>
              {item.crime_type
                ?.split("-")
                .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(" ") || "Unknown"}
            </Text>
            <Text style={s.cardSub}>
              {resident?.full_name || "Unknown"} • {formatDate(item.created_at)}
            </Text>
          </View>
        </View>

        {item.description && (
          <Text style={s.cardDesc} numberOfLines={2}>
            {item.description}
          </Text>
        )}

        {item.location_address && (
          <View style={s.cardMeta}>
            <Ionicons name="location" size={14} color="#3B82F6" />
            <Text style={s.cardMetaText} numberOfLines={1}>
              {item.location_address}
            </Text>
          </View>
        )}

        {getEvidenceUrls(item.photo_url).length > 0 && (
          <View style={s.cardEvidenceBadge}>
            <Ionicons name="images" size={14} color="#64748B" />
            <Text style={s.cardEvidenceText}>
              {getEvidenceUrls(item.photo_url).length} evidence photo(s)
            </Text>
          </View>
        )}

        {status === "pending" && (
          <View style={s.actions}>
            <TouchableOpacity
              style={s.declineBtn}
              onPress={() => updateStatus(item.id, "dismissed")}
            >
              <Text style={s.declineBtnText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.acceptBtn}
              onPress={() => updateStatus(item.id, "in-progress")}
            >
              <Text style={s.acceptBtnText}>Accept</Text>
            </TouchableOpacity>
          </View>
        )}

        {status === "in-progress" && (
          <View style={s.actions}>
            <TouchableOpacity
              style={s.acceptBtn}
              onPress={() => router.push(`/report/${item.id}` as any)}
            >
              <Text style={s.acceptBtnText}>View More</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={["top"]} style={s.header}>
        <View style={s.headerContent}>
          <Text style={s.headerTitle}>Reports</Text>
          <TouchableOpacity onPress={loadReports}>
            <Ionicons name="refresh" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {alertBanner && (
        <View style={{
          backgroundColor: "#DC2626",
          paddingHorizontal: 16,
          paddingVertical: 12,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14, flex: 1 }}>
            {alertBanner}
          </Text>
          <TouchableOpacity onPress={() => setAlertBanner(null)}>
            <Ionicons name="close" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      <View style={s.filterRow}>
        {["all", "pending", "in-progress", "resolved"].map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={[s.filterBtn, filter === f && s.filterBtnActive]}
          >
            <Text
              style={[s.filterText, filter === f && s.filterTextActive]}
            >
              {f === "all" ? "All" : f.replace("-", " ")}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={s.empty}>
          <ActivityIndicator size="large" color="#17202b" />
        </View>
      ) : filteredReports.length === 0 ? (
        <View style={s.empty}>
          <View style={s.emptyIcon}>
            <Ionicons name="document-text" size={32} color="#CBD5E1" />
          </View>
          <Text style={s.emptyTitle}>No Reports</Text>
          <Text style={s.emptyText}>No {filter} reports at this time.</Text>
        </View>
      ) : (
        <FlatList
          data={filteredReports}
          keyExtractor={(item) => item.id?.toString()}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => renderReportCard(item)}
        />
      )}

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
                  {(residents[selectedReport.resident_id]?.avatar_url || residents[selectedReport.resident_id]?.photo_url) ? (
                    <Image
                      source={{ uri: residents[selectedReport.resident_id]?.avatar_url || residents[selectedReport.resident_id]?.photo_url }}
                      style={s.modalResidentPhoto}
                    />
                  ) : (
                    <View style={[s.modalResidentPhoto, { backgroundColor: "#F1F5F9", justifyContent: "center", alignItems: "center" }]}>
                      <Ionicons name="person" size={18} color="#94A3B8" />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={s.modalResidentName}>
                      {residents[selectedReport.resident_id]?.full_name || "Unknown Resident"}
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
                          onPress={() => navigateToRoute(selectedReport.latitude, selectedReport.longitude, selectedReport.resident_id)}
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
                        {getEvidenceUrls(selectedReport.photo_url).map((url, idx) => (
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

                <View style={s.modalActions}>
                  {selectedReport.status === "pending" && (
                    <>
                      <TouchableOpacity
                        style={[s.modalActionBtn, { backgroundColor: "#FEE2E2", borderWidth: 0 }]}
                        onPress={() => updateStatus(selectedReport.id, "dismissed")}
                      >
                        <Text style={{ color: "#DC2626", fontWeight: "700", fontSize: 13 }}>Dismiss</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.modalActionBtn, { backgroundColor: "#17202b" }]}
                        onPress={() => updateStatus(selectedReport.id, "in-progress")}
                      >
                        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Accept</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {selectedReport.status === "in-progress" && selectedReport.latitude && selectedReport.longitude && (
                    <>
                      <TouchableOpacity
                        style={[s.modalActionBtn, { backgroundColor: "#DBEAFE" }]}
                        onPress={() => navigateToRoute(selectedReport.latitude, selectedReport.longitude, selectedReport.resident_id)}
                      >
                        <Ionicons name="navigate" size={16} color="#2563EB" />
                        <Text style={{ color: "#2563EB", fontWeight: "700", fontSize: 13 }}>Navigate</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.modalActionBtn, { backgroundColor: "#17202b" }]}
                        onPress={() => updateStatus(selectedReport.id, "resolved")}
                      >
                        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Resolve</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>

                <View style={{ height: 20 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
