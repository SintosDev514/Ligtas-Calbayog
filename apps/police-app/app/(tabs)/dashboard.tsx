import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
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
  Vibration,
  Alert,
} from "react-native";
import { Audio } from "expo-av";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { supabase } from "../../../../shared/supabase/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import { statusColors, crimeIcons, colors } from "../../constants/theme";
import { dashboardStyles as s } from "../styles/Dashboard.styles";
import MapView, { Marker } from "../../components/MapView";
import { openBestStreetView } from "../../../../shared/utils/streetView";
import { upsertPoliceLocation } from "../../../../shared/services/reportService";

export default function DashboardScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [residents, setResidents] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterMap, setFilterMap] = useState<"all" | "emergency">("all");
  const [mapStyle, setMapStyle] = useState<any>("light");
  const [showStylePicker, setShowStylePicker] = useState(false);
  const [selectedResident, setSelectedResident] = useState<any | null>(null);
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [alertBanner, setAlertBanner] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{latitude: number; longitude: number} | null>(null);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [policePosts, setPolicePosts] = useState<any[]>([]);
  const alertTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastAlertIdRef = useRef<string | null>(null);
  const locationWatchRef = useRef<any>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const soundLoaded = useRef(false);
  const activeAlertIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    loadData();
    const channel = supabase
      .channel("police-dashboard")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "crime_reports" },
        (payload) => {
          const report = payload.new as any;
          if (report.id === lastAlertIdRef.current) return;
          lastAlertIdRef.current = report.id;
          playEmergencyAlert(report);
          refreshData();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "crime_reports" },
        (payload) => {
          const updated = payload.new as any;
          if (updated.status === "in-progress") {
            stopAlertForReport(updated.id);
          }
          if (updated.id === activeReportId && (updated.status === "resolved" || updated.status === "dismissed")) {
            setActiveReportId(null);
          }
          refreshData();
        },
      )
      .subscribe();
    const poll = setInterval(refreshData, 15_000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
      try { Vibration.cancel(); } catch (_) {}
      soundRef.current?.stopAsync().catch(() => {});
      soundRef.current?.setIsLoopingAsync(false).catch(() => {});
      activeAlertIds.current.clear();
    };
  }, []);

  // Fallback: alert on any new pending report from polls too, skip on initial data load
  const prevReportIds = useRef<Set<string>>(new Set());
  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      for (const r of reports) prevReportIds.current.add(r.id);
      return;
    }
    for (const r of reports) {
      if (r.status === "pending" && !prevReportIds.current.has(r.id)) {
        playEmergencyAlert(r);
      }
      prevReportIds.current.add(r.id);
    }
  }, [reports]);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          console.log("Location permission denied");
          return;
        }
        locationWatchRef.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 0 },
          (pos) => setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        );
      } catch (err) {
        console.warn("expo-location failed, fallback to navigator.geolocation:", err);
        if (!navigator.geolocation) return;
        const watchId = navigator.geolocation.watchPosition(
          (pos) => setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
          (err) => console.warn("Geolocation error:", err.message),
          { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
        );
        locationWatchRef.current = { remove: () => navigator.geolocation.clearWatch(watchId) };
      }
    })();
    return () => { locationWatchRef.current?.remove?.(); };
  }, []);

  // Heartbeat: upload location every ~30s so admin tracking shows "online"
  const lastHeartbeatRef = useRef(0);
  useEffect(() => {
    if (!profile?.id || !userLocation) return;
    const now = Date.now();
    if (!activeReportId && now - lastHeartbeatRef.current < 25000) return;
    if (activeReportId && now - lastHeartbeatRef.current < 5000) return;
    lastHeartbeatRef.current = now;
    upsertPoliceLocation(profile.id, activeReportId, userLocation.latitude, userLocation.longitude)
      .catch((err) => console.warn("Heartbeat failed:", err.message));
  }, [profile?.id, userLocation, activeReportId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
        });
        const { sound } = await Audio.Sound.createAsync(
          require("../../assets/emergency_alert.wav"),
          { volume: 1.0 },
        );
        if (mounted) {
          soundRef.current = sound;
          soundLoaded.current = true;
        }
      } catch (e) {
        console.warn("Audio setup failed:", e);
      }
    })();
    return () => {
      mounted = false;
      soundRef.current?.unloadAsync();
    };
  }, []);

  const playEmergencyAlert = async (report: any) => {
    if (activeAlertIds.current.has(report.id)) return;
    activeAlertIds.current.add(report.id);
    console.log("playEmergencyAlert called for:", report.id, report.crime_type);

    try {
      Vibration.vibrate(500);
      setTimeout(() => {
        try { Vibration.vibrate([500, 300, 500, 300, 500], true); } catch (_) {}
      }, 600);
    } catch (e) {
      console.warn("Vibration failed:", e);
    }

    const label = report.crime_type?.replace(/-/g, " ") || "New report";
    setAlertBanner(`⚠️ Emergency: ${label}`);
    if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
    alertTimerRef.current = setTimeout(() => setAlertBanner(null), 5000);

    // Audio: manual loop with 1s gap between plays
    const playLoop = async (retries = 3) => {
      if (activeAlertIds.current.size === 0) return;
      try {
        const sound = soundRef.current;
        if (sound && soundLoaded.current) {
          await sound.stopAsync();
          await sound.setPositionAsync(0);
          await sound.playAsync();
        } else if (retries > 0) {
          setTimeout(() => playLoop(retries - 1), 500);
          return;
        }
      } catch (e) {
        console.warn("Audio playback failed:", e);
      }
      if (activeAlertIds.current.size > 0) {
        setTimeout(playLoop, 1000);
      }
    };
    playLoop();
  };

  const stopAlertForReport = async (reportId: string) => {
    if (!activeAlertIds.current.has(reportId)) return;
    activeAlertIds.current.delete(reportId);
    console.log("stopAlertForReport called for:", reportId, "remaining:", activeAlertIds.current.size);
    if (activeAlertIds.current.size === 0) {
      try { Vibration.cancel(); } catch (e) { console.warn("Vibration cancel failed:", e); }
      try {
        const sound = soundRef.current;
        if (sound) {
          await sound.stopAsync();
        }
      } catch (e) { console.warn("Audio stop failed:", e); }
    }
    setAlertBanner(null);
    if (alertTimerRef.current) { clearTimeout(alertTimerRef.current); alertTimerRef.current = null; }
  };

  const openStreetView = useCallback(() => {
    if (!selectedResident?.latitude || !selectedResident?.longitude) return;
    const { latitude, longitude } = selectedResident;
    openBestStreetView(latitude, longitude, Linking);
  }, [selectedResident]);

  const navigateToResident = useCallback(() => {
    if (!selectedResident?.latitude || !selectedResident?.longitude || !userLocation) return;
    const params = new URLSearchParams({
      sourceLat: userLocation.latitude.toString(),
      sourceLng: userLocation.longitude.toString(),
      destLat: selectedResident.latitude.toString(),
      destLng: selectedResident.longitude.toString(),
      name: selectedResident.full_name || "Resident",
    });
    closeModal();
    router.push(`/navigate/${selectedResident.id}?${params.toString()}` as any);
  }, [selectedResident, userLocation]);

  const closeModal = useCallback(() => {
    setSelectedResident(null);
    setSelectedReport(null);
  }, []);

  const handleAccept = async () => {
    if (!selectedReport) return;
    try {
      await supabase
        .from("crime_reports")
        .update({
          status: "in-progress",
          assigned_officer_id: profile?.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedReport.id);

      setSelectedReport((prev: any) => prev ? { ...prev, status: "in-progress" } : null);
      setActiveReportId(selectedReport.id);
      stopAlertForReport(selectedReport.id);
      if (userLocation) {
        upsertPoliceLocation(profile!.id, selectedReport.id, userLocation.latitude, userLocation.longitude)
          .catch((err) => console.warn("Location upsert after accept failed:", err.message));
      }
    } catch (err: any) {
      console.warn("Accept failed:", err);
      Alert.alert("Error", err.message || "Failed to accept report");
    }
  };

  const handleDecline = async () => {
    if (!selectedReport) return;
    try {
      await supabase
        .from("crime_reports")
        .update({ status: "dismissed", updated_at: new Date().toISOString() })
        .eq("id", selectedReport.id);
      setSelectedReport((prev: any) => prev ? { ...prev, status: "dismissed" } : null);
      stopAlertForReport(selectedReport.id);
    } catch (err: any) {
      console.warn("Decline failed:", err);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [residentData, reportsData, postsData] = await Promise.all([
        supabase.from("resident_profiles").select("*"),
        supabase
          .from("crime_reports")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase.from("police_posts").select("*").order("name"),
      ]);
      if (residentData.error) throw residentData.error;
      if (reportsData.error) throw reportsData.error;
      setResidents(residentData.data || []);
      setReports(reportsData.data || []);
      setPolicePosts(postsData.data || []);
    } catch (err: any) {
      console.error("Failed to load data:", err);
      setError(err?.message || "Failed to load data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    try {
      const [residentData, reportsData, postsData] = await Promise.all([
        supabase.from("resident_profiles").select("*"),
        supabase
          .from("crime_reports")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase.from("police_posts").select("*").order("name"),
      ]);
      if (residentData.data) setResidents(residentData.data);
      if (reportsData.data) setReports(reportsData.data);
      if (postsData.data) setPolicePosts(postsData.data);
    } catch (err) {
      console.error("Realtime refresh failed:", err);
    }
  };

  const pendingReports = reports.filter((r) => r.status === "pending").length;
  const totalResidents = residents.length;
  const residentsWithLocation = residents.filter((r) => r.latitude).length;

  const emergencyReportIds = useMemo(
    () => new Set(reports.filter((r) => r.status === "pending").map((r) => r.resident_id)),
    [reports],
  );

  const allResidentsWithLocation = residents.filter(
    (r) => r.latitude && r.longitude,
  );
  const emergencyResidents = allResidentsWithLocation.filter((r) =>
    emergencyReportIds.has(r.id),
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
      const residentReports = reports
        .filter((r) => r.resident_id === resident.id)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setSelectedReport(residentReports[0] || null);
    }
  };

  const renderResidentMarker = (resident: any) => (
    <Marker
      key={`r-${resident.id}`}
      coordinate={{
        latitude: resident.latitude,
        longitude: resident.longitude,
      }}
      pinColor={emergencyReportIds.has(resident.id) ? "#EF4444" : "#22C55E"}
      popupHtml={getResidentPopupHtml(resident)}
      animate={emergencyReportIds.has(resident.id)}
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

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0f141a" }}>
          <ActivityIndicator size="large" color="#F4B51A" />
        </View>
      ) : error ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 24, backgroundColor: "#0f141a" }}>
          <Ionicons name="cloud-offline" size={48} color="#64748B" />
          <Text style={{ fontSize: 16, color: "#94A3B8", textAlign: "center", marginTop: 12, marginBottom: 20 }}>
            {error}
          </Text>
          <TouchableOpacity
            onPress={loadData}
            style={{
              backgroundColor: "rgba(244,181,26,0.15)",
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: "rgba(244,181,26,0.3)",
            }}
          >
            <Text style={{ color: "#F4B51A", fontWeight: "700", fontSize: 14 }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={s.mapContainer}>
          <View style={s.mapOverlayRight}>
            <View style={s.compactStatsRow}>
              <View style={s.compactStat}>
                <Ionicons name="people" size={9} color="#60A5FA" />
                <Text style={s.compactStatValue}>{totalResidents}</Text>
                <Text style={s.compactStatLabel}>Residents</Text>
              </View>
              <View style={s.compactStat}>
                <Ionicons name="time" size={9} color="#FBBF24" />
                <Text style={s.compactStatValue}>{pendingReports}</Text>
                <Text style={s.compactStatLabel}>Pending</Text>
              </View>
              <View style={s.compactStat}>
                <Ionicons name="document-text" size={9} color="#34D399" />
                <Text style={s.compactStatValue}>{reports.length}</Text>
                <Text style={s.compactStatLabel}>Reports</Text>
              </View>
            </View>
          </View>
          <View style={s.mapOverlayTop}>
            <View style={s.filterRow}>
              <TouchableOpacity
                style={s.styleBtn}
                onPress={() => setShowStylePicker(true)}
              >
                <Ionicons name="layers" size={13} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
              <View style={{ flexDirection: "row", gap: 4 }}>
                <TouchableOpacity
                  style={[
                    s.filterBtn,
                    filterMap === "all" && s.filterBtnActive,
                  ]}
                  onPress={() => setFilterMap("all")}
                >
                  <Ionicons
                    name="people"
                    size={11}
                    color={filterMap === "all" ? colors.accent : "rgba(255,255,255,0.45)"}
                  />
                  <Text
                    style={[
                      s.filterBtnText,
                      filterMap === "all" && s.filterBtnTextActive,
                    ]}
                  >
                    All ({allResidentsWithLocation.length})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    s.filterBtn,
                    filterMap === "emergency" && s.filterBtnActive,
                    filterMap !== "emergency" && { backgroundColor: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.25)" },
                  ]}
                  onPress={() => setFilterMap("emergency")}
                >
                  <Ionicons
                    name="alert-circle"
                    size={11}
                    color={filterMap === "emergency" ? colors.accent : "#EF4444"}
                  />
                  <Text
                    style={[
                      s.filterBtnText,
                      filterMap === "emergency" && s.filterBtnTextActive,
                      filterMap !== "emergency" && { color: "#EF4444" },
                    ]}
                  >
                    {emergencyResidents.length}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {showStylePicker && (
            <View style={s.stylePickerOverlay}>
              <TouchableOpacity
                style={{ flex: 1 }}
                activeOpacity={1}
                onPress={() => setShowStylePicker(false)}
              />
              <View style={s.stylePickerPanel}>
                <View style={s.stylePickerHandle} />
                <Text style={s.stylePickerTitle}>Map Style</Text>
                {[
                  { key: "light", label: "Light", icon: "sunny-outline" },
                  { key: "dark", label: "Dark", icon: "moon-outline" },
                  { key: "street", label: "Street", icon: "map-outline" },
                ].map((style) => (
                  <TouchableOpacity
                    key={style.key}
                    style={[
                      s.stylePickerItem,
                      mapStyle === style.key && s.stylePickerItemActive,
                    ]}
                    onPress={() => {
                      setMapStyle(style.key);
                      setShowStylePicker(false);
                    }}
                  >
                    <Ionicons
                      name={style.icon as any}
                      size={18}
                      color={mapStyle === style.key ? "#F4B51A" : "rgba(255,255,255,0.6)"}
                    />
                    <Text
                      style={[
                        s.stylePickerItemText,
                        mapStyle === style.key && s.stylePickerItemTextActive,
                      ]}
                    >
                      {style.label}
                    </Text>
                    {mapStyle === style.key && (
                      <Ionicons name="checkmark" size={18} color="#F4B51A" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <MapView
            style={{ flex: 1 }}
            initialRegion={{
              latitude: centerLat,
              longitude: centerLng,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
            mapStyle={mapStyle}
            scrollEnabled
            zoomEnabled
            onMarkerPress={handleMarkerPress}
          >
            {visibleResidents.map(renderResidentMarker)}
              {userLocation && (
                <Marker
                  coordinate={userLocation}
                  pinColor="#3B82F6"
                >
                  {profile?.photo_url || profile?.police_id_photo_url ? (
                    <Image
                      source={{ uri: profile.photo_url || profile.police_id_photo_url! }}
                      style={{ width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: "#3B82F6" }}
                    />
                  ) : (
                    <Image
                      source={Image.resolveAssetSource(require("../../assets/logo-black.png"))}
                      style={{ width: 28, height: 28, borderRadius: 14 }}
                    />
                  )}
                </Marker>
              )}
              {policePosts.map((post) => (
                <Marker
                  key={`post-${post.id}`}
                  coordinate={{ latitude: post.latitude, longitude: post.longitude }}
                  pinColor="#F59E0B"
                  title={`${post.name} (Police Post)`}
                />
              ))}
          </MapView>
        </View>
      )}

      <Modal
        visible={!!selectedResident}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <TouchableOpacity
          style={s.modalOverlay}
          activeOpacity={1}
          onPress={closeModal}
        >
          <TouchableOpacity
            style={s.modalContent}
            activeOpacity={1}
            onPress={() => {}}
          >
            {selectedResident && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <TouchableOpacity style={s.modalCloseBtn} onPress={closeModal}>
                  <Ionicons name="close" size={18} color="#94A3B8" />
                </TouchableOpacity>

                <View style={s.modalHeader}>
                  <View style={s.modalAvatar}>
                    {(selectedResident.avatar_url || selectedResident.photo_url) ? (
                      <Image
                        source={{ uri: selectedResident.avatar_url || selectedResident.photo_url }}
                        style={s.modalAvatarImage}
                      />
                    ) : (
                      <View style={s.modalAvatarPlaceholder}>
                        <Ionicons name="person" size={28} color="#64748B" />
                      </View>
                    )}
                    <View style={s.modalOnlineDot} />
                  </View>
                  <Text style={s.modalName}>
                    {selectedResident.full_name || "Unknown"}
                  </Text>
                  <Text style={s.modalBadge}>
                    <Ionicons name="location-outline" size={12} color="#64748B" /> {selectedResident.address || "No address on file"}
                  </Text>
                </View>

                {selectedReport ? (
                  <>
                    <View style={s.modalReportCard}>
                      <View style={s.modalReportCardHeader}>
                        <View style={s.modalCrimeIconWrap}>
                          <Ionicons
                            name={(crimeIcons as any)[selectedReport.crime_type] || "alert-circle"}
                            size={22}
                            color={statusColors[selectedReport.status]?.text || "#EF4444"}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.modalReportCrime}>
                            {selectedReport.crime_type?.replace(/-/g, " ") || "Unspecified"}
                          </Text>
                          <Text style={s.modalReportDate}>
                            {new Date(selectedReport.created_at).toLocaleDateString("en-PH", {
                              month: "long",
                              day: "numeric",
                              year: "numeric",
                            })} • {new Date(selectedReport.created_at).toLocaleTimeString("en-PH", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </Text>
                        </View>
                        <View style={[s.modalStatusBadge, { backgroundColor: statusColors[selectedReport.status]?.bg || "#F1F5F9" }]}>
                          <Ionicons
                            name={statusColors[selectedReport.status]?.icon || "ellipse"}
                            size={10}
                            color={statusColors[selectedReport.status]?.text || "#64748B"}
                          />
                          <Text style={[s.modalStatusText, { color: statusColors[selectedReport.status]?.text || "#64748B" }]}>
                            {selectedReport.status?.replace("-", " ") || "Unknown"}
                          </Text>
                        </View>
                      </View>

                      {selectedReport.description ? (
                        <View style={s.modalDescWrap}>
                          <Ionicons name="chatbubble-ellipses-outline" size={14} color="#64748B" style={{ marginTop: 2 }} />
                          <Text style={s.modalReportDesc}>{selectedReport.description}</Text>
                        </View>
                      ) : null}

                      {selectedReport.location_address && (
                        <View style={s.modalLocRow}>
                          <Ionicons name="navigate-outline" size={14} color="#64748B" />
                          <Text style={s.modalLocText}>{selectedReport.location_address}</Text>
                        </View>
                      )}
                    </View>

                    {selectedReport.status === "pending" ? (
                      <View style={s.modalActionsDouble}>
                        <TouchableOpacity style={s.modalAcceptBtn} onPress={handleAccept} activeOpacity={0.8}>
                          <Ionicons name="checkmark-circle" size={20} color="#fff" />
                          <Text style={s.modalAcceptBtnText}>Accept</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.modalDeclineBtn} onPress={handleDecline} activeOpacity={0.8}>
                          <Ionicons name="close-circle" size={20} color="#fff" />
                          <Text style={s.modalDeclineBtnText}>Decline</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={s.modalActionsDouble}>
                        {userLocation && (
                          <TouchableOpacity
                            style={s.modalNavBtn}
                            onPress={navigateToResident}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="navigate" size={20} color="#fff" />
                            <Text style={s.modalNavBtnText}>Navigate</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={[s.modalStreetBtn, !userLocation && { flex: 1 }]}
                          onPress={openStreetView}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="eye" size={20} color="#1e40af" />
                          <Text style={s.modalStreetBtnText}>Street View</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    <TouchableOpacity
                      style={s.modalProfileBtn}
                      onPress={() => {
                        closeModal();
                        router.push(`/resident/${selectedResident.id}` as any);
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="person-outline" size={16} color="#0f141a" />
                      <Text style={s.modalProfileBtnText}>View Full Profile</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={s.modalEmptyWrap}>
                    <Ionicons name="document-text-outline" size={40} color="#4A5568" />
                    <Text style={s.modalEmptyText}>No report on file</Text>
                  </View>
                )}
              </ScrollView>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
