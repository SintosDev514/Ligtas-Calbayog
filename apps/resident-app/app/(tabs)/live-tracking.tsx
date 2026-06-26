import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "../../../../shared/supabase/supabaseClient";
import {
  fetchPoliceLocation,
  subscribeToPoliceLocation,
} from "../../../../shared/services/reportService";
import { useLocation } from "../../context/LocationContext";
import { useMapStyle } from "../../context/MapStyleContext";
import MapView, { Marker, Polyline, UrlTile } from "../../components/MapView";

const OSRM_BASE = "https://router.project-osrm.org/route/v1/driving";

async function fetchRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): Promise<{ coordinates: { latitude: number; longitude: number }[]; distanceKm: number; durationMin: number } | null> {
  try {
    const url = `${OSRM_BASE}/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson&steps=false`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.routes?.length) return null;
    const route = data.routes[0];
    const coords = route.geometry.coordinates.map((c: number[]) => ({
      latitude: c[1],
      longitude: c[0],
    }));
    return {
      coordinates: coords,
      distanceKm: route.distance / 1000,
      durationMin: route.duration / 60,
    };
  } catch {
    return null;
  }
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

function formatETA(min: number): string {
  if (min < 1) return "Arriving soon";
  if (min < 60) return `${Math.round(min)} min`;
  const hrs = Math.floor(min / 60);
  const rem = Math.round(min % 60);
  return `${hrs}h ${rem}m`;
}

export default function LiveTrackingScreen() {
  const router = useRouter();
  const { reportId } = useLocalSearchParams<{ reportId: string }>();
  const { location: residentLocation, getLocation } = useLocation();
  const { tileUrl, mapStyle } = useMapStyle();

  const [report, setReport] = useState<any>(null);
  const [policeLocation, setPoliceLocation] = useState<{
    latitude: number; longitude: number; officer_id?: string;
  } | null>(null);
  const [policeInfo, setPoliceInfo] = useState<{ full_name?: string; badge_id?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(true);

  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[] | null>(null);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeDuration, setRouteDuration] = useState<number | null>(null);

  const subscriptionRef = useRef<any>(null);
  const pollingRef = useRef<number | null>(null);

  const getRoute = useCallback(async () => {
    if (!policeLocation || !residentLocation) return;
    const result = await fetchRoute(
      policeLocation.latitude, policeLocation.longitude,
      residentLocation.latitude, residentLocation.longitude,
    );
    if (result) {
      setRouteCoords(result.coordinates);
      setRouteDistance(result.distanceKm);
      setRouteDuration(result.durationMin);
    }
  }, [policeLocation, residentLocation]);

  useEffect(() => {
    if (!reportId) { setError("No report ID provided."); setIsLoading(false); return; }
    loadInitialData();
    getLocation();
    return () => {
      if (subscriptionRef.current) supabase.removeChannel(subscriptionRef.current);
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [reportId]);

  // Poll for location updates only when isLive is true
  useEffect(() => {
    if (!reportId || !isLive) return;
    pollingRef.current = setInterval(async () => {
      try {
        const loc = await fetchPoliceLocation(reportId);
        if (loc) {
          setPoliceLocation({ latitude: loc.latitude, longitude: loc.longitude, officer_id: loc.officer_id });
          if (loc.police_profiles && !policeInfo) setPoliceInfo(loc.police_profiles);
        }
      } catch {}
    }, 5000);
    return () => { if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; } };
  }, [reportId, isLive]);

  // Re-fetch route whenever police or resident location changes
  useEffect(() => {
    getRoute();
  }, [getRoute]);

  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      const { data: reportData } = await supabase
        .from("crime_reports").select("*").eq("id", reportId).single();
      if (reportData) setReport(reportData);

      const locData = await fetchPoliceLocation(reportId);
      if (locData) {
        setPoliceLocation({ latitude: locData.latitude, longitude: locData.longitude, officer_id: locData.officer_id });
        if (locData.police_profiles) setPoliceInfo(locData.police_profiles);
      }

      subscribeToUpdates();
    } catch (err: any) {
      setError(err.message || "Failed to load tracking data.");
    } finally {
      setIsLoading(false);
    }
  };

  const subscribeToUpdates = () => {
    if (!reportId) return;
    const sub = subscribeToPoliceLocation(reportId, (data: any) => {
      if (data) setPoliceLocation({ latitude: data.latitude, longitude: data.longitude, officer_id: data.officer_id });
    });
    subscriptionRef.current = sub;
  };

  const getStatusColor = () => {
    if (!routeDistance) return "#94A3B8";
    if (routeDistance < 1) return "#10B981";
    if (routeDistance < 3) return "#F59E0B";
    return "#EF4444";
  };

  const getStatusText = () => {
    if (!routeDistance) return "Waiting for signal";
    if (routeDistance < 1) return "Police nearby";
    if (routeDistance < 3) return "Police approaching";
    return "Police en route";
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={styles.loadingText}>Connecting to tracking...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" />
        <View style={styles.errorCircle}><Ionicons name="alert-circle-outline" size={48} color="#EF4444" /></View>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.backBtnLarge} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={16} color="#fff" /><Text style={styles.backBtnLargeText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const region = {
    latitude: policeLocation?.latitude || report?.latitude || residentLocation?.latitude || 12.061,
    longitude: policeLocation?.longitude || report?.longitude || residentLocation?.longitude || 124.596,
    latitudeDelta: 0.03,
    longitudeDelta: 0.03,
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <MapView
        style={styles.map}
        initialRegion={region}
        mapStyle={mapStyle}
        scrollEnabled
        zoomEnabled
        showsUserLocation={false}
      >
        <UrlTile urlTemplate={tileUrl} />

        {routeCoords && (
          <Polyline
            coordinates={routeCoords}
            strokeColor="#3B82F6"
            strokeWidth={5}
          />
        )}

        {report?.latitude && report?.longitude && (
          <Marker
            coordinate={{ latitude: report.latitude, longitude: report.longitude }}
            pinColor="#EF4444"
            iconName="warning"
            title="Incident Location"
          />
        )}

        {policeLocation && (
          <Marker
            coordinate={{ latitude: policeLocation.latitude, longitude: policeLocation.longitude }}
            pinColor="#3B82F6"
            iconName="shield"
            title={policeInfo?.full_name || "Police Officer"}
          />
        )}

        {residentLocation && (
          <Marker
            coordinate={{ latitude: residentLocation.latitude, longitude: residentLocation.longitude }}
            pinColor="#10B981"
            iconName="person"
            title="Your Location"
          />
        )}
      </MapView>

      <View style={styles.topOverlay}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.topTitleGroup}>
            <Text style={styles.topTitle}>Live Tracking</Text>
            <Text style={styles.topSub}>
              {policeInfo?.full_name || "Police Officer"}{policeInfo?.badge_id ? ` • ${policeInfo.badge_id}` : ""}
            </Text>
          </View>
          <TouchableOpacity style={[styles.liveBtn, isLive && styles.liveBtnActive]} onPress={() => setIsLive(!isLive)}>
            <View style={[styles.liveDot, isLive && styles.liveDotActive]} />
            <Text style={styles.liveBtnText}>{isLive ? "LIVE" : "OFF"}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.infoCard}>
        <LinearGradient colors={["#1E293B", "#0F172A"]} style={StyleSheet.absoluteFill} />
        <View style={styles.infoCardContent}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
            <Text style={styles.statusText}>{getStatusText()}</Text>
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Ionicons name="navigate" size={18} color="#818CF8" />
              <Text style={styles.metricValue}>
                {routeDistance !== null ? formatDistance(routeDistance) : "---"}
              </Text>
              <Text style={styles.metricLabel}>Route Distance</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Ionicons name="time" size={18} color="#34D399" />
              <Text style={styles.metricValue}>
                {routeDuration !== null ? formatETA(routeDuration) : "---"}
              </Text>
              <Text style={styles.metricLabel}>Est. Arrival</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Ionicons name="shield-checkmark" size={18} color="#FCD34D" />
              <Text style={styles.metricValue}>
                {report?.crime_type
                  ? report.crime_type.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
                  : "Report"}
              </Text>
              <Text style={styles.metricLabel}>Incident Type</Text>
            </View>
          </View>

          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#3B82F6" }]} />
              <Text style={styles.legendText}>Police</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#10B981" }]} />
              <Text style={styles.legendText}>You</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#EF4444" }]} />
              <Text style={styles.legendText}>Incident</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0F172A", padding: 32 },
  loadingText: { color: "#94A3B8", fontSize: 14, fontWeight: "600", marginTop: 16 },
  errorCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#FEF2F2", justifyContent: "center", alignItems: "center", marginBottom: 16 },
  errorText: { color: "#94A3B8", fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 20 },
  backBtnLarge: { flexDirection: "row", alignItems: "center", backgroundColor: "#17202b", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, gap: 8 },
  backBtnLargeText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  map: { flex: 1 },
  topOverlay: { position: "absolute", top: 0, left: 0, right: 0, paddingTop: Platform.OS === "ios" ? 50 : 30, paddingHorizontal: 16 },
  topBar: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(15,23,42,0.85)", borderRadius: 16, padding: 10, gap: 10 },
  backBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.1)", justifyContent: "center", alignItems: "center" },
  topTitleGroup: { flex: 1 },
  topTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  topSub: { color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 1 },
  liveBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.1)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, gap: 6 },
  liveBtnActive: { backgroundColor: "rgba(239,68,68,0.2)" },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#94A3B8" },
  liveDotActive: { backgroundColor: "#EF4444" },
  liveBtnText: { fontSize: 11, fontWeight: "700", color: "#fff", letterSpacing: 0.5 },
  infoCard: { position: "absolute", bottom: 0, left: 0, right: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden" },
  infoCardContent: { padding: 20, paddingBottom: Platform.OS === "ios" ? 34 : 24 },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 16 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  metricsRow: { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 14, padding: 14, marginBottom: 14 },
  metricItem: { flex: 1, alignItems: "center", gap: 4 },
  metricDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.1)", alignSelf: "stretch" },
  metricValue: { color: "#fff", fontSize: 14, fontWeight: "700", textAlign: "center" },
  metricLabel: { color: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  legendRow: { flexDirection: "row", justifyContent: "center", gap: 20 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: "500" },
});
