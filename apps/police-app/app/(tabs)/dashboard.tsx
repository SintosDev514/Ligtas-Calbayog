import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Image,
  Vibration,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { supabase } from "../../../../shared/supabase/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import { useAlarm } from "../../context/AlarmContext";
import { statusColors, crimeIcons, colors } from "../../constants/theme";
import { dashboardStyles as s } from "../styles/Dashboard.styles";
import MapView, { Marker } from "../../components/MapView";
import { upsertPoliceLocation } from "../../../../shared/services/reportService";

export default function DashboardScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const { alertBanner, setAlertBanner, playEmergencyAlert, stopAlertForReport } = useAlarm();
  const [residents, setResidents] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterMap, setFilterMap] = useState<"all" | "emergency">("all");
  const [mapStyle, setMapStyle] = useState<any>("light");
  const [showStylePicker, setShowStylePicker] = useState(false);
  const [userLocation, setUserLocation] = useState<{latitude: number; longitude: number} | null>(null);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [policePosts, setPolicePosts] = useState<any[]>([]);
  const [mapRegion, setMapRegion] = useState({ latitude: 12.061, longitude: 124.596, latitudeDelta: 0.05, longitudeDelta: 0.05 });
  const lastAlertIdRef = useRef<string | null>(null);
  const locationWatchRef = useRef<any>(null);
  const mapRef = useRef<any>(null);

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
          if (report.latitude && report.longitude) {
            setMapRegion({
              latitude: report.latitude,
              longitude: report.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            });
          }
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
    };
  }, []);

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
        if (status !== "granted") return;
        locationWatchRef.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 0 },
          (pos) => setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        );
      } catch (err) {
        if (!navigator.geolocation) return;
        const watchId = navigator.geolocation.watchPosition(
          (pos) => setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
          () => {},
          { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
        );
        locationWatchRef.current = { remove: () => navigator.geolocation.clearWatch(watchId) };
      }
    })();
    return () => { locationWatchRef.current?.remove?.(); };
  }, []);

  const lastHeartbeatRef = useRef(0);
  useEffect(() => {
    if (!profile?.id || !userLocation) return;
    const now = Date.now();
    if (!activeReportId && now - lastHeartbeatRef.current < 25000) return;
    if (activeReportId && now - lastHeartbeatRef.current < 5000) return;
    lastHeartbeatRef.current = now;
    upsertPoliceLocation(profile.id, activeReportId, userLocation.latitude, userLocation.longitude)
      .catch(() => {});
  }, [profile?.id, userLocation, activeReportId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [residentData, reportsData, postsData] = await Promise.all([
        supabase.from("resident_profiles").select("*"),
        supabase.from("crime_reports").select("*").order("created_at", { ascending: false }),
        supabase.from("police_posts").select("*").order("name"),
      ]);
      if (residentData.error) throw residentData.error;
      if (reportsData.error) throw reportsData.error;
      setResidents(residentData.data || []);
      setReports(reportsData.data || []);
      setPolicePosts(postsData.data || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load data.");
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    const [residentData, reportsData, postsData] = await Promise.all([
      supabase.from("resident_profiles").select("*"),
      supabase.from("crime_reports").select("*").order("created_at", { ascending: false }),
      supabase.from("police_posts").select("*").order("name"),
    ]);
    if (residentData.data) setResidents(residentData.data);
    if (reportsData.data) setReports(reportsData.data);
    if (postsData.data) setPolicePosts(postsData.data);
  };

  const pendingReports = reports.filter((r) => r.status === "pending").length;
  const totalResidents = residents.length;

  const emergencyReportIds = useMemo(
    () => new Set(reports.filter((r) => r.status === "pending").map((r) => r.resident_id)),
    [reports],
  );

  const allResidentsWithLocation = residents.filter((r) => r.latitude && r.longitude);

  const reportsWithLocation = useMemo(
    () => reports.filter((r) => r.latitude && r.longitude),
    [reports],
  );

  const reportResidentIds = useMemo(() => new Set(reportsWithLocation.map((r) => r.resident_id)), [reportsWithLocation]);

  const residentsWithoutReports = allResidentsWithLocation.filter((r) => !reportResidentIds.has(r.id));

  const emergencyReports = reportsWithLocation.filter((r) => r.status === "pending");
  const emergencyResidents = allResidentsWithLocation.filter((r) => emergencyReportIds.has(r.id) && !reportResidentIds.has(r.id));

  const visibleReports = filterMap === "emergency"
    ? emergencyReports
    : reportsWithLocation;
  const visibleResidents = filterMap === "emergency"
    ? emergencyResidents
    : residentsWithoutReports;

  const allVisibleCoords = [
    ...visibleReports.map((r) => ({ latitude: r.latitude, longitude: r.longitude })),
    ...visibleResidents.map((r) => ({ latitude: r.latitude, longitude: r.longitude })),
  ];

  const centerLat = allVisibleCoords.length > 0
    ? allVisibleCoords.reduce((s, c) => s + c.latitude, 0) / allVisibleCoords.length
    : 12.061;
  const centerLng = allVisibleCoords.length > 0
    ? allVisibleCoords.reduce((s, c) => s + c.longitude, 0) / allVisibleCoords.length
    : 124.596;

  const handleMarkerPress = (markerData: any) => {
    const report = visibleReports.find(
      (r) => r.latitude === markerData.coordinate.latitude && r.longitude === markerData.coordinate.longitude,
    );
    if (report) {
      router.push(`/report/${report.id}` as any);
      return;
    }
    const resident = visibleResidents.find(
      (r) => r.latitude === markerData.coordinate.latitude && r.longitude === markerData.coordinate.longitude,
    );
    if (!resident) return;
    const latestReport = reports
      .filter((r) => r.resident_id === resident.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    if (latestReport) {
      router.push(`/report/${latestReport.id}` as any);
    } else {
      router.push(`/resident/${resident.id}` as any);
    }
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />

      {alertBanner && (
        <View style={{ backgroundColor: "#DC2626", paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14, flex: 1 }}>{alertBanner}</Text>
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
          <Text style={{ fontSize: 16, color: "#94A3B8", textAlign: "center", marginTop: 12, marginBottom: 20 }}>{error}</Text>
          <TouchableOpacity onPress={loadData} style={{ backgroundColor: "rgba(244,181,26,0.15)", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: "rgba(244,181,26,0.3)" }}>
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
              <TouchableOpacity style={s.styleBtn} onPress={() => setShowStylePicker(true)}>
                <Ionicons name="layers" size={13} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
              <View style={{ flexDirection: "row", gap: 4 }}>
                <TouchableOpacity
                  style={[s.filterBtn, filterMap === "all" && s.filterBtnActive]}
                  onPress={() => setFilterMap("all")}
                >
                  <Ionicons name="people" size={11} color={filterMap === "all" ? colors.accent : "rgba(255,255,255,0.45)"} />
                  <Text style={[s.filterBtnText, filterMap === "all" && s.filterBtnTextActive]}>All ({allVisibleCoords.length})</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.filterBtn, filterMap === "emergency" && s.filterBtnActive, filterMap !== "emergency" && { backgroundColor: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.25)" }]}
                  onPress={() => setFilterMap("emergency")}
                >
                  <Ionicons name="alert-circle" size={11} color={filterMap === "emergency" ? colors.accent : "#EF4444"} />
                  <Text style={[s.filterBtnText, filterMap === "emergency" && s.filterBtnTextActive, filterMap !== "emergency" && { color: "#EF4444" }]}>{emergencyReports.length + emergencyResidents.length}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {showStylePicker && (
            <View style={s.stylePickerOverlay}>
              <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowStylePicker(false)} />
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
                    style={[s.stylePickerItem, mapStyle === style.key && s.stylePickerItemActive]}
                    onPress={() => { setMapStyle(style.key); setShowStylePicker(false); }}
                  >
                    <Ionicons name={style.icon as any} size={18} color={mapStyle === style.key ? "#F4B51A" : "rgba(255,255,255,0.6)"} />
                    <Text style={[s.stylePickerItemText, mapStyle === style.key && s.stylePickerItemTextActive]}>{style.label}</Text>
                    {mapStyle === style.key && <Ionicons name="checkmark" size={18} color="#F4B51A" />}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <MapView
            ref={mapRef}
            style={{ flex: 1 }}
            initialRegion={{ latitude: centerLat, longitude: centerLng, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
            region={mapRegion}
            mapStyle={mapStyle}
            scrollEnabled
            zoomEnabled
            onMarkerPress={handleMarkerPress}
          >
            {visibleReports.map((report) => {
              const isPending = report.status === "pending";
              const meta = statusColors[report.status] || statusColors.pending;
              return (
                <Marker
                  key={`rp-${report.id}`}
                  coordinate={{ latitude: report.latitude, longitude: report.longitude }}
                  pinColor={isPending ? "#EF4444" : meta.text || "#F59E0B"}
                  animate={isPending}
                  title={`${report.crime_type?.replace(/-/g, " ") || "Report"} — ${report.status}`}
                />
              );
            })}
            {visibleResidents.map((resident) => {
              const hasEmergency = emergencyReportIds.has(resident.id);
              return (
                <Marker
                  key={`r-${resident.id}`}
                  coordinate={{ latitude: resident.latitude, longitude: resident.longitude }}
                  pinColor={hasEmergency ? "#EF4444" : "#22C55E"}
                  animate={hasEmergency}
                >
                  {(resident.avatar_url || resident.photo_url) ? (
                    <Image source={{ uri: resident.avatar_url || resident.photo_url }} style={{ width: 28, height: 28, borderRadius: 14 }} />
                  ) : null}
                </Marker>
              );
            })}
            {userLocation && (
              <Marker coordinate={userLocation} pinColor="#3B82F6">
                {profile?.photo_url || profile?.police_id_photo_url ? (
                  <Image source={{ uri: profile.photo_url || profile.police_id_photo_url! }} style={{ width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: "#3B82F6" }} />
                ) : (
                  <Image source={Image.resolveAssetSource(require("../../assets/logo-black.png"))} style={{ width: 28, height: 28, borderRadius: 14 }} />
                )}
              </Marker>
            )}
            {policePosts.map((post) => (
              <Marker key={`post-${post.id}`} coordinate={{ latitude: post.latitude, longitude: post.longitude }} pinColor="#F59E0B" title={`${post.name} (Police Post)`} />
            ))}
          </MapView>
        </View>
      )}
    </View>
  );
}
