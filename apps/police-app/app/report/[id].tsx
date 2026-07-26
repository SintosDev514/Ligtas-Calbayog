import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  StatusBar,
  Alert,
  Linking,
  ActivityIndicator,
  Dimensions,
  Modal,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../../../shared/supabase/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import { statusColors, crimeIcons, colors } from "../../constants/theme";
import { openBestStreetView } from "../../../../shared/utils/streetView";
import MapView, { Marker } from "../../components/MapView";
import { Image as ExpoImage } from "expo-image";
import { Video, ResizeMode } from "expo-av";
import * as Location from "expo-location";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const isVideoUrl = (url: string) => /\.(mp4|webm|mov|avi)$/i.test(url);

const Card = ({ children, style }: { children: React.ReactNode; style?: any }) => (
  <View
    style={{
      backgroundColor: "rgba(255,255,255,0.03)",
      borderRadius: 16,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.06)",
      overflow: "hidden",
      ...style,
    }}
  >
    {children}
  </View>
);

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <Text
    style={{
      fontSize: 11,
      fontWeight: "700",
      color: "rgba(255,255,255,0.25)",
      textTransform: "uppercase",
      letterSpacing: 1.2,
      marginBottom: 10,
    }}
  >
    {children}
  </Text>
);

export default function ReportDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [report, setReport] = useState<any>(null);
  const [resident, setResident] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerZoom, setViewerZoom] = useState(1);

  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [userHeading, setUserHeading] = useState(0);
  const [routeData, setRouteData] = useState<any>(null);
  const [routeDistance, setRouteDistance] = useState<string | null>(null);
  const [routeDuration, setRouteDuration] = useState<string | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const lastRouteUpdateRef = useRef(0);

  const loadReport = useCallback(async () => {
    if (!id) return;
    try {
      const { data: reportData } = await supabase
        .from("crime_reports")
        .select("*")
        .eq("id", id)
        .single();
      if (reportData) {
        setReport(reportData);
        if (reportData.resident_id) {
          const { data: resData } = await supabase
            .from("resident_profiles")
            .select("*")
            .eq("id", reportData.resident_id)
            .single();
          if (resData) setResident(resData);
        }
      }
    } catch (e) {
      console.warn("Failed to load report:", e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadReport();
    const channel = supabase
      .channel(`report-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "crime_reports", filter: `id=eq.${id}` },
        (payload) => {
          setReport((prev: any) => ({ ...prev, ...payload.new }));
        },
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [id]);

  const fetchRoute = useCallback(
    async (from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) => {
      setLoadingRoute(true);
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?geometries=geojson&overview=full`;
        const res = await fetch(url);
        const json = await res.json();
        if (json.code === "Ok" && json.routes?.length) {
          const route = json.routes[0];
          setRouteData({ geometry: route.geometry });
          setRouteDistance(`${(route.distance / 1000).toFixed(1)} km`);
          setRouteDuration(`${Math.round(route.duration / 60)} min`);
        }
      } catch (e) {
        console.warn("Route fetch failed:", e);
      } finally {
        setLoadingRoute(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!report?.latitude || !report?.longitude) return;
    if (report.status !== "pending" && report.status !== "in-progress") return;

    let sub: Location.LocationSubscription | null = null;
    let headingSub: Location.LocationSubscription | null = null;
    let dest = { latitude: report.latitude, longitude: report.longitude };
    let firstFix = true;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 10,
          timeInterval: 5000,
        },
        (pos) => {
          const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          setUserLocation(loc);
          if (typeof pos.coords.heading === "number" && pos.coords.heading > 0) {
            setUserHeading(pos.coords.heading);
          }

          if (firstFix) {
            firstFix = false;
            fetchRoute(loc, dest);
            return;
          }

          const now = Date.now();
          if (now - lastRouteUpdateRef.current > 15000) {
            lastRouteUpdateRef.current = now;
            fetchRoute(loc, dest);
          }
        },
      );

      headingSub = await Location.watchHeadingAsync((h) => {
        setUserHeading(h.magHeading ?? h.trueHeading ?? 0);
      });
    })();

    return () => {
      sub?.remove();
      headingSub?.remove();
    };
  }, [report?.id, report?.status, report?.latitude, report?.longitude]);

  const handleAccept = async () => {
    if (!report || accepting) return;
    setAccepting(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("crime_reports")
        .update({
          status: "in-progress",
          assigned_officer_id: profile?.id,
          updated_at: now,
        })
        .eq("id", report.id);
      if (error) throw error;

      await supabase.from("action_updates").insert({
        report_id: report.id,
        action_type: "accepted",
        officer_id: profile?.id,
        description: `${profile?.full_name || "Officer"} accepted this report`,
        created_at: now,
      });

      setReport((prev: any) => ({ ...prev, status: "in-progress", assigned_officer_id: profile?.id }));
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to accept report");
    } finally {
      setAccepting(false);
    }
  };

  const handleResolve = async () => {
    if (!report || resolving) return;
    setResolving(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("crime_reports")
        .update({ status: "resolved", updated_at: now })
        .eq("id", report.id);
      if (error) throw error;

      await supabase.from("action_updates").insert({
        report_id: report.id,
        action_type: "resolved",
        officer_id: profile?.id,
        description: `${profile?.full_name || "Officer"} resolved this report`,
        created_at: now,
      });

      setReport((prev: any) => ({ ...prev, status: "resolved" }));
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to resolve report");
    } finally {
      setResolving(false);
    }
  };

  const handleStreetView = () => {
    if (!report?.latitude || !report?.longitude) return;
    openBestStreetView(report.latitude, report.longitude, Linking);
  };

  const evidenceUrls: string[] = report?.photo_url
    ? report.photo_url.split(",").map((u: string) => u.trim()).filter(Boolean)
    : [];

  const status = report?.status || "pending";
  const meta = statusColors[status] || statusColors.pending;
  const isEmergency = ["emergency", "robbery", "assault", "hit-and-run", "burglary", "theft"].includes(report?.crime_type);

  const openViewer = (idx: number) => {
    setViewerIndex(idx);
    setViewerZoom(1);
    setViewerVisible(true);
  };

  const zoomStep = (dir: number) => {
    setViewerZoom((z) => {
      const next = z + dir * 0.5;
      return Math.max(0.5, Math.min(4, next));
    });
  };

  const hasRoute = !!routeData;
  const showMap = report?.latitude && report?.longitude;

  const centerLat = showMap
    ? userLocation
      ? (userLocation.latitude + report.latitude) / 2
      : report.latitude
    : 0;
  const centerLng = showMap
    ? userLocation
      ? (userLocation.longitude + report.longitude) / 2
      : report.longitude
    : 0;
  const latDelta = showMap && userLocation
    ? Math.max(Math.abs(userLocation.latitude - report.latitude) * 1.8, 0.015)
    : 0.015;
  const lngDelta = showMap && userLocation
    ? Math.max(Math.abs(userLocation.longitude - report.longitude) * 1.8, 0.015)
    : 0.015;

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.primary, justifyContent: "center", alignItems: "center" }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(244,181,26,0.12)", justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
        <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginTop: 16, fontWeight: "500" }}>Loading report...</Text>
      </View>
    );
  }

  if (!report) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.primary, justifyContent: "center", alignItems: "center", padding: 24 }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(255,255,255,0.04)", justifyContent: "center", alignItems: "center", marginBottom: 16 }}>
          <Ionicons name="document-text-outline" size={32} color="rgba(255,255,255,0.2)" />
        </View>
        <Text style={{ fontSize: 17, fontWeight: "700", color: "#fff", marginBottom: 6 }}>Report Not Found</Text>
        <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", marginBottom: 24, textAlign: "center" }}>This report may have been removed or you don't have access.</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ backgroundColor: "rgba(244,181,26,0.12)", paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: "rgba(244,181,26,0.2)" }}>
          <Text style={{ color: colors.accent, fontWeight: "700", fontSize: 14 }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderViewerItem = ({ item }: { item: string }) => {
    if (isVideoUrl(item)) {
      return (
        <View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, justifyContent: "center", alignItems: "center", padding: 20 }}>
          <Video
            source={{ uri: item }}
            style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH * 0.6 }}
            resizeMode={ResizeMode.CONTAIN}
            useNativeControls
            shouldPlay={false}
            isLooping={false}
          />
        </View>
      );
    }
    return (
      <View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, justifyContent: "center", alignItems: "center" }}>
        <ScrollView
          maximumZoomScale={4}
          minimumZoomScale={1}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          centerContent
        >
          <ExpoImage
            source={{ uri: item }}
            style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.75 }}
            contentFit="contain"
            enableZoomGesture
            transform={[{ scale: viewerZoom }]}
          />
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.primary }}>
      <StatusBar barStyle="light-content" />

      <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.headerBg }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.06)", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}
          >
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 17, fontWeight: "700", color: "#fff" }}>Report Details</Text>
            <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>
              ID: {id?.slice(0, 8) || "—"}
            </Text>
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 20,
              backgroundColor: meta.bg,
            }}
          >
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: meta.text }} />
            <Text style={{ fontSize: 11, fontWeight: "700", color: meta.text, textTransform: "uppercase" }}>
              {status.replace("-", " ")}
            </Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 130 }}>
        {/* Reporter Info */}
        {resident && (
          <Card style={{ marginHorizontal: 16, marginTop: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16 }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  borderWidth: 2,
                  borderColor: colors.accent,
                  overflow: "hidden",
                  backgroundColor: "rgba(255,255,255,0.04)",
                }}
              >
                {(resident.avatar_url || resident.photo_url) ? (
                  <Image source={{ uri: resident.avatar_url || resident.photo_url }} style={{ width: 48, height: 48 }} />
                ) : (
                  <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(244,181,26,0.08)" }}>
                    <Ionicons name="person" size={20} color={colors.accent} />
                  </View>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>{resident.full_name || "Unknown Resident"}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
                  <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.3)" />
                  <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }} numberOfLines={1}>
                    {resident.address || "No address provided"}
                  </Text>
                </View>
                {resident.emergency_contact && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                    <Ionicons name="call-outline" size={12} color="rgba(255,255,255,0.25)" />
                    <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>{resident.emergency_contact}</Text>
                  </View>
                )}
              </View>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.15)" />
            </View>
          </Card>
        )}

        {/* Crime Type + Timestamp */}
        <View style={{ paddingHorizontal: 16, marginTop: 20 }}>
          <Card>
            <View style={{ padding: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 14 }}>
                <View
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: 14,
                    backgroundColor: isEmergency ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.04)",
                    justifyContent: "center",
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: isEmergency ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.06)",
                  }}
                >
                  <Ionicons
                    name={(crimeIcons as any)[report.crime_type] || "alert-circle"}
                    size={24}
                    color={isEmergency ? "#EF4444" : meta.text}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 18, fontWeight: "700", color: "#fff", textTransform: "capitalize" }}>
                    {report.crime_type?.replace(/-/g, " ") || "Unspecified"}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Ionicons name="calendar-outline" size={12} color="rgba(255,255,255,0.25)" />
                      <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
                        {new Date(report.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                      </Text>
                    </View>
                    <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: "rgba(255,255,255,0.15)" }} />
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.25)" />
                      <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
                        {new Date(report.created_at).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
              {report.location_address && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.05)" }}>
                  <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: "rgba(59,130,246,0.12)", justifyContent: "center", alignItems: "center" }}>
                    <Ionicons name="location" size={16} color="#3B82F6" />
                  </View>
                  <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", flex: 1 }}>{report.location_address}</Text>
                </View>
              )}
            </View>
          </Card>
        </View>

        {/* Description */}
        {report.description && (
          <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
            <Card>
              <View style={{ padding: 16 }}>
                <SectionLabel>Description</SectionLabel>
                <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", lineHeight: 22 }}>
                  {report.description}
                </Text>
              </View>
            </Card>
          </View>
        )}

        {/* Map + Route */}
        {showMap && (
          <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
            <Card>
              <View style={{ padding: 14 }}>
                <SectionLabel>Route Overview</SectionLabel>
                <View style={{ height: 240, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
                <MapView
                  style={{ flex: 1 }}
                  initialRegion={{ latitude: centerLat, longitude: centerLng, latitudeDelta: latDelta, longitudeDelta: lngDelta }}
                  mapStyle="street"
                  routeData={routeData}
                  userHeading={userHeading}
                >
                  {userLocation && (
                    <Marker coordinate={userLocation} pinColor="#3B82F6" heading={userHeading} />
                  )}
                    <Marker coordinate={{ latitude: report.latitude, longitude: report.longitude }} pinColor="#EF4444" title="Incident Location" />
                  </MapView>
                </View>

                {/* Route Stats */}
                <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                  <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 12, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" }}>
                    {loadingRoute ? (
                      <ActivityIndicator size="small" color={colors.accent} />
                    ) : (
                      <>
                        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(59,130,246,0.12)", justifyContent: "center", alignItems: "center", marginBottom: 6 }}>
                          <Ionicons name="navigate" size={16} color="#3B82F6" />
                        </View>
                        <Text style={{ fontSize: 16, fontWeight: "700", color: "#fff" }}>{routeDistance || "—"}</Text>
                        <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 2 }}>Distance</Text>
                      </>
                    )}
                  </View>
                  <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 12, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" }}>
                    {loadingRoute ? (
                      <ActivityIndicator size="small" color={colors.accent} />
                    ) : (
                      <>
                        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(16,185,129,0.12)", justifyContent: "center", alignItems: "center", marginBottom: 6 }}>
                          <Ionicons name="time" size={16} color="#10B981" />
                        </View>
                        <Text style={{ fontSize: 16, fontWeight: "700", color: "#fff" }}>{routeDuration || "—"}</Text>
                        <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 2 }}>Est. Time</Text>
                      </>
                    )}
                  </View>
                  <TouchableOpacity
                    style={{ flex: 1, backgroundColor: "rgba(37,107,235,0.08)", borderRadius: 12, padding: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(37,107,235,0.15)" }}
                    onPress={handleStreetView}
                    activeOpacity={0.7}
                  >
                    <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(37,107,235,0.15)", justifyContent: "center", alignItems: "center", marginBottom: 6 }}>
                      <Ionicons name="eye" size={16} color="#60A5FA" />
                    </View>
                    <Text style={{ fontSize: 10, color: "#60A5FA", fontWeight: "600" }}>Street View</Text>
                  </TouchableOpacity>
                </View>

                {/* Map Legend */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.04)" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#3B82F6" }} />
                    <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Your Location</Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#EF4444" }} />
                    <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Incident</Text>
                  </View>
                  {hasRoute && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <View style={{ width: 16, height: 3, borderRadius: 1.5, backgroundColor: "#EF4444" }} />
                      <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Route</Text>
                    </View>
                  )}
                </View>
              </View>
            </Card>
          </View>
        )}

        {/* Evidence */}
        {evidenceUrls.length > 0 && (
          <View style={{ paddingHorizontal: 16, marginTop: 12, marginBottom: 8 }}>
            <Card>
              <View style={{ padding: 14 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <SectionLabel>Evidence</SectionLabel>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.04)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                    <Ionicons name="film" size={12} color="rgba(255,255,255,0.3)" />
                    <Text style={{ fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.35)" }}>{evidenceUrls.length} files</Text>
                  </View>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {evidenceUrls.map((url: string, idx: number) => {
                    const isVid = isVideoUrl(url);
                    return (
                      <TouchableOpacity key={idx} activeOpacity={0.7} onPress={() => openViewer(idx)}>
                        <View
                          style={{
                            width: 140,
                            height: 120,
                            borderRadius: 12,
                            overflow: "hidden",
                            backgroundColor: "rgba(255,255,255,0.03)",
                            borderWidth: 1,
                            borderColor: "rgba(255,255,255,0.06)",
                          }}
                        >
                          {isVid ? (
                            <>
                              <Video
                                source={{ uri: url }}
                                style={{ width: "100%", height: "100%" }}
                                resizeMode={ResizeMode.COVER}
                                shouldPlay={false}
                                isMuted
                                useNativeControls={false}
                              />
                              <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.35)" }}>
                                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.9)", justifyContent: "center", alignItems: "center" }}>
                                  <Ionicons name="play" size={16} color="#000" style={{ marginLeft: 2 }} />
                                </View>
                              </View>
                              <View style={{ position: "absolute", bottom: 6, right: 6, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                                <Ionicons name="videocam" size={10} color="#fff" />
                              </View>
                            </>
                          ) : (
                            <Image source={{ uri: url }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </Card>
          </View>
        )}
      </ScrollView>

      {/* Bottom Action Bar */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: "rgba(255,255,255,0.06)",
          paddingHorizontal: 20,
          paddingBottom: 16 + insets.bottom,
          paddingTop: 16,
        }}
      >
        {status === "pending" ? (
          <TouchableOpacity
            style={{
              backgroundColor: "#16A34A",
              borderRadius: 14,
              paddingVertical: 16,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              shadowColor: "#16A34A",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 12,
              elevation: 6,
            }}
            onPress={handleAccept}
            disabled={accepting}
            activeOpacity={0.8}
          >
            {accepting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
            )}
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
              {accepting ? "Accepting..." : "Accept & Respond"}
            </Text>
          </TouchableOpacity>
        ) : status === "in-progress" ? (
          <View style={{ flexDirection: "row", gap: 10 }}>
            {resident?.emergency_contact && (
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: "rgba(59,130,246,0.12)",
                  borderRadius: 14,
                  paddingVertical: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  borderWidth: 1,
                  borderColor: "rgba(59,130,246,0.2)",
                }}
                onPress={() => Linking.openURL(`tel:${resident.emergency_contact}`)}
                activeOpacity={0.8}
              >
                <Ionicons name="call" size={18} color="#3B82F6" />
                <Text style={{ color: "#60A5FA", fontSize: 14, fontWeight: "700" }}>Call</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={{
                flex: resident?.emergency_contact ? 1.2 : 1,
                backgroundColor: "#16A34A",
                borderRadius: 14,
                paddingVertical: 16,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                shadowColor: "#16A34A",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 12,
                elevation: 6,
              }}
              onPress={handleResolve}
              disabled={resolving}
              activeOpacity={0.8}
            >
              {resolving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="checkmark-done-circle" size={20} color="#fff" />
              )}
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
                {resolving ? "Resolving..." : "Resolve"}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={{
              backgroundColor: "rgba(255,255,255,0.04)",
              borderRadius: 14,
              paddingVertical: 14,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.06)",
            }}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Ionicons name="chevron-back" size={16} color="rgba(255,255,255,0.35)" />
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, fontWeight: "600" }}>Back to Dashboard</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Evidence Viewer Modal */}
      <Modal visible={viewerVisible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setViewerVisible(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.97)" }}>
          <StatusBar hidden />
          <SafeAreaView style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: "600" }}>
              {viewerIndex + 1} of {evidenceUrls.length}
            </Text>
            <TouchableOpacity
              onPress={() => setViewerVisible(false)}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.1)", justifyContent: "center", alignItems: "center" }}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={18} color="#fff" />
            </TouchableOpacity>
          </SafeAreaView>

          <FlatList
            data={evidenceUrls}
            horizontal
            pagingEnabled
            initialScrollIndex={viewerIndex}
            getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              setViewerIndex(idx);
              setViewerZoom(1);
            }}
            showsHorizontalScrollIndicator={false}
            keyExtractor={(_, idx) => String(idx)}
            renderItem={renderViewerItem}
          />

          {!isVideoUrl(evidenceUrls[viewerIndex]) && (
            <View style={{ position: "absolute", bottom: 80, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 12, zIndex: 10 }}>
              <TouchableOpacity
                onPress={() => zoomStep(-1)}
                style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.1)", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}
                activeOpacity={0.7}
              >
                <Ionicons name="remove" size={20} color="#fff" />
              </TouchableOpacity>
              <View style={{ height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.1)", justifyContent: "center", alignItems: "center", paddingHorizontal: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
                <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>{Math.round(viewerZoom * 100)}%</Text>
              </View>
              <TouchableOpacity
                onPress={() => zoomStep(1)}
                style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.1)", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

          <View style={{ position: "absolute", bottom: 40, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 6 }}>
            {evidenceUrls.map((_: string, idx: number) => (
              <View
                key={idx}
                style={{
                  width: idx === viewerIndex ? 22 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: idx === viewerIndex ? colors.accent : "rgba(255,255,255,0.2)",
                }}
              />
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}
