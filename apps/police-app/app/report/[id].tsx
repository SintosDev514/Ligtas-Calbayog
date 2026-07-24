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
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../../../shared/supabase/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import { statusColors, crimeIcons, colors } from "../../constants/theme";
import { upsertPoliceLocation } from "../../../../shared/services/reportService";
import { openBestStreetView } from "../../../../shared/utils/streetView";
import MapView, { Marker } from "../../components/MapView";
import { Image as ExpoImage } from "expo-image";
import { Video, ResizeMode } from "expo-av";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const isVideoUrl = (url: string) => /\.(mp4|webm|mov|avi)$/i.test(url);

export default function ReportDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const router = useRouter();
  const [report, setReport] = useState<any>(null);
  const [resident, setResident] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerZoom, setViewerZoom] = useState(1);

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
      Alert.alert("Accepted", "Report accepted. You are now responding.");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to accept report");
    } finally {
      setAccepting(false);
    }
  };

  const handleResolve = async () => {
    if (!report) return;
    try {
      const { error } = await supabase
        .from("crime_reports")
        .update({ status: "resolved", updated_at: new Date().toISOString() })
        .eq("id", report.id);
      if (error) throw error;
      setReport((prev: any) => ({ ...prev, status: "resolved" }));
      Alert.alert("Resolved", "Report marked as resolved.");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to resolve report");
    }
  };

  const handleNavigate = () => {
    if (!resident?.latitude || !resident?.longitude) return;
    router.push(`/navigate/${resident.id}?sourceLat=0&sourceLng=0&destLat=${resident.latitude}&destLng=${resident.longitude}&name=${encodeURIComponent(resident.full_name || "Resident")}` as any);
  };

  const handleStreetView = () => {
    if (!resident?.latitude || !resident?.longitude) return;
    openBestStreetView(resident.latitude, resident.longitude, Linking);
  };

  const evidenceUrls: string[] = report?.photo_url
    ? report.photo_url.split(",").map((u: string) => u.trim()).filter(Boolean)
    : [];

  const status = report?.status || "pending";
  const meta = statusColors[status] || statusColors.pending;

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

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.primary, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!report) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.primary, justifyContent: "center", alignItems: "center", padding: 24 }}>
        <Ionicons name="document-text-outline" size={48} color="#64748B" />
        <Text style={{ fontSize: 16, color: "#94A3B8", marginTop: 12 }}>Report not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20, backgroundColor: colors.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 }}>
          <Text style={{ color: colors.primaryDark, fontWeight: "700" }}>Go Back</Text>
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
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.08)", justifyContent: "center", alignItems: "center" }}>
            <Ionicons name="arrow-back" size={18} color="#fff" />
          </TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: "700", color: "#fff", flex: 1 }}>Report Details</Text>
          <View style={[meta.bg ? { backgroundColor: meta.bg } : {}, { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 }]}>
            <Ionicons name={(meta.icon as any) || "ellipse"} size={10} color={meta.text} />
            <Text style={{ fontSize: 10, fontWeight: "700", color: meta.text, textTransform: "uppercase" }}>{status.replace("-", " ")}</Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {resident && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: colors.accent, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.06)" }}>
              {(resident.avatar_url || resident.photo_url) ? (
                <Image source={{ uri: resident.avatar_url || resident.photo_url }} style={{ width: 56, height: 56 }} />
              ) : (
                <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                  <Ionicons name="person" size={24} color="#64748B" />
                </View>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: "700", color: "#fff" }}>{resident.full_name || "Unknown"}</Text>
              <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                <Ionicons name="location-outline" size={11} color="rgba(255,255,255,0.35)" /> {resident.address || "No address"}
              </Text>
              {resident.emergency_contact && (
                <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
                  <Ionicons name="call-outline" size={11} color="rgba(255,255,255,0.3)" /> {resident.emergency_contact}
                </Text>
              )}
            </View>
          </View>
        )}

        <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16 }}>
            <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.06)", justifyContent: "center", alignItems: "center" }}>
              <Ionicons name={(crimeIcons as any)[report.crime_type] || "alert-circle"} size={24} color={meta.text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#fff", textTransform: "capitalize" }}>
                {report.crime_type?.replace(/-/g, " ") || "Unspecified"}
              </Text>
              <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
                {new Date(report.created_at).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })} •{" "}
                {new Date(report.created_at).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
              </Text>
            </View>
          </View>

          {report.description && (
            <View style={{ backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
              <Text style={{ fontSize: 10, fontWeight: "700", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>Description</Text>
              <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", lineHeight: 22 }}>{report.description}</Text>
            </View>
          )}

          {report.location_address && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
              <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: "rgba(59,130,246,0.15)", justifyContent: "center", alignItems: "center" }}>
                <Ionicons name="location" size={16} color="#3B82F6" />
              </View>
              <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", flex: 1 }}>{report.location_address}</Text>
            </View>
          )}

          {report.latitude && report.longitude && (
            <View style={{ height: 180, borderRadius: 12, overflow: "hidden", marginBottom: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
              <MapView
                style={{ flex: 1 }}
                initialRegion={{ latitude: report.latitude, longitude: report.longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 }}
                scrollEnabled={false}
                zoomEnabled={false}
              >
                <Marker coordinate={{ latitude: report.latitude, longitude: report.longitude }} pinColor={meta.text} />
              </MapView>
            </View>
          )}

          {evidenceUrls.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 10, fontWeight: "700", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>
                Evidence ({evidenceUrls.length})
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  {evidenceUrls.map((url: string, idx: number) => {
                    const isVid = isVideoUrl(url);
                    return (
                      <TouchableOpacity
                        key={idx}
                        activeOpacity={0.85}
                        onPress={() => openViewer(idx)}
                      >
                        <View style={{ width: SCREEN_WIDTH * 0.55, height: 180, borderRadius: 12, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.04)" }}>
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
                              <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.3)" }}>
                                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.85)", justifyContent: "center", alignItems: "center" }}>
                                  <Ionicons name="play" size={22} color="#000" style={{ marginLeft: 2 }} />
                                </View>
                              </View>
                              <View style={{ position: "absolute", top: 8, right: 8, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                                <Ionicons name="videocam" size={12} color="#fff" />
                              </View>
                            </>
                          ) : (
                            <Image
                              source={{ uri: url }}
                              style={{ width: "100%", height: "100%" }}
                              resizeMode="cover"
                            />
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)", paddingHorizontal: 20, paddingBottom: 32, paddingTop: 16 }}>
        {status === "pending" ? (
          <TouchableOpacity
            style={{ backgroundColor: "#16A34A", borderRadius: 12, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
            onPress={handleAccept}
            disabled={accepting}
            activeOpacity={0.8}
          >
            {accepting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
            )}
            <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>{accepting ? "Accepting..." : "Accept Report"}</Text>
          </TouchableOpacity>
        ) : status === "in-progress" ? (
          <View style={{ flexDirection: "row", gap: 10 }}>
            {resident?.latitude && (
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: "#3B82F6", borderRadius: 12, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}
                onPress={handleNavigate}
                activeOpacity={0.8}
              >
                <Ionicons name="navigate" size={18} color="#fff" />
                <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>Navigate</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: "#16A34A", borderRadius: 12, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}
              onPress={handleResolve}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-done" size={18} color="#fff" />
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>Resolve</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={{ backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 12, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, fontWeight: "700" }}>Back to Dashboard</Text>
          </TouchableOpacity>
        )}
      </View>

      <Modal visible={viewerVisible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setViewerVisible(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.97)" }}>
          <StatusBar hidden />
          <SafeAreaView style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
            <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, fontWeight: "600" }}>
              {viewerIndex + 1} / {evidenceUrls.length}
            </Text>
            <TouchableOpacity
              onPress={() => setViewerVisible(false)}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.12)", justifyContent: "center", alignItems: "center" }}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={20} color="#fff" />
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
            <View style={{ position: "absolute", bottom: 80, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 16, zIndex: 10 }}>
              <TouchableOpacity
                onPress={() => zoomStep(-1)}
                style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.12)", justifyContent: "center", alignItems: "center" }}
                activeOpacity={0.7}
              >
                <Ionicons name="remove" size={22} color="#fff" />
              </TouchableOpacity>
              <View style={{ height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.12)", justifyContent: "center", alignItems: "center", paddingHorizontal: 16 }}>
                <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>{Math.round(viewerZoom * 100)}%</Text>
              </View>
              <TouchableOpacity
                onPress={() => zoomStep(1)}
                style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.12)", justifyContent: "center", alignItems: "center" }}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

          <View style={{ position: "absolute", bottom: 40, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 6 }}>
            {evidenceUrls.map((_: string, idx: number) => (
              <View
                key={idx}
                style={{
                  width: idx === viewerIndex ? 20 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: idx === viewerIndex ? "#fff" : "rgba(255,255,255,0.25)",
                }}
              />
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}
