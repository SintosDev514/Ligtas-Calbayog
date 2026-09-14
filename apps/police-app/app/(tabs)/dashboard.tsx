import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Image,
  Vibration,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { supabase } from "@shared/supabase/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import { useAlarm } from "../../context/AlarmContext";
import { statusColors, crimeIcons, colors } from "../../constants/theme";
import { dashboardStyles as s } from "../../styles/Dashboard.styles";
import MapView, { Marker } from "../../components/MapView";
import { upsertPoliceLocation } from "@shared/services/reportService";

// ---- Auto-validation / triage helpers ----
// Mirrors public.compute_triage_score() in db/migrations/043_add_auto_triage.sql
// and the admin web's ReportTriage fallback, so the police dashboard ranks the
// most urgent reports first even when the DB columns aren't backfilled yet.
const ACTIVE_STATUSES = ["pending", "under-review", "in-progress", "investigating", "needs-backup"];
const FIRST_RESPONSE_STATUSES = ["pending", "under-review"];
const URGENCY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const URGENCY_COLORS: Record<string, string> = { critical: "#EF4444", high: "#F59E0B", medium: "#3B82F6", low: "#64748B" };

const TRIAGE_BASE_SCORE: Record<string, number> = {
  emergency: 95,
  "hit-and-run": 85,
  robbery: 80,
  assault: 70,
  burglary: 65,
  theft: 45,
  vandalism: 30,
  "lost-item": 25,
  noise: 25,
  complaint: 25,
  accident: 25,
};

const TRIAGE_CRITICAL = ["gun", "firearm", "knife", "weapon", "armed", "shooting", "shots", "shot", "stabbed", "stabbing", "dead", "killed", "killing", "murder", "unconscious", "bleeding", "blood", "hostage", "kidnapp", "abduct", "drowning", "explosion", "bomb", "burning", "carjacking", "hijack"];
const TRIAGE_URGENT = ["in progress", "in-progress", "right now", "immediately", "urgent", "emergency", "danger", "threat", "asap", "ongoing", "on-going", "happening now"];
const TRIAGE_VULNERABLE = ["child", "children", "student", "school ", "elderly", "disabled", "pregnant"];
const TRIAGE_DOUBT = ["false report", "joke", "prank", "hoax", "just checking", "already resolved", "mistaken", "accidentally submitted", "never happened", "not real"];

const hasAnyKeyword = (text: string, keywords: string[]) => keywords.some((k) => text.includes(k));

const computeTriageScore = (r: any): number => {
  const type = (r.crime_type || "").toLowerCase();
  const desc = (r.description || "").toLowerCase();
  let score = TRIAGE_BASE_SCORE[type] ?? 45;

  if (desc) {
    if (hasAnyKeyword(desc, TRIAGE_CRITICAL)) score += 15;
    if (hasAnyKeyword(desc, TRIAGE_URGENT)) score += 10;
    if (hasAnyKeyword(desc, TRIAGE_VULNERABLE)) score += 8;
    if (hasAnyKeyword(desc, TRIAGE_DOUBT)) score -= 25;
    if ((r.description || "").length >= 40) score += 3;
  } else {
    score -= 8;
  }

  if (r.share_live_location) score += 8;
  if (r.photo_url) score += 5;
  if (r.latitude != null && r.longitude != null) score += 3;
  else score -= 6;

  const hour = r.created_at ? new Date(r.created_at).getHours() : -1;
  if (Number.isFinite(hour) && (hour >= 22 || hour < 5)) score += 5;

  return Math.max(0, Math.min(100, score));
};

const urgencyForScore = (score: number) =>
  score >= 75 ? "critical" : score >= 55 ? "high" : score >= 30 ? "medium" : "low";

const effectiveScore = (r: any): number =>
  typeof r.triage_score === "number" ? r.triage_score : computeTriageScore(r);

const effectiveUrgency = (r: any): string => {
  const score = effectiveScore(r);
  if (typeof r.triage_score === "number") return r.urgency || urgencyForScore(score);
  if (r.urgency && r.urgency !== "medium") return r.urgency;
  return urgencyForScore(score);
};

const timeAgo = (iso?: string) => {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

export default function DashboardScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const { alertBanner, setAlertBanner, playEmergencyAlert, stopAlertForReport, stopAllAlarms } = useAlarm();
  const [residents, setResidents] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triageFilter, setTriageFilter] = useState<"first" | "critical" | "high" | "validated" | "dismissed">("first");
  const [userLocation, setUserLocation] = useState<{latitude: number; longitude: number} | null>(null);
  const [userHeading, setUserHeading] = useState<number | null>(null);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [policePosts, setPolicePosts] = useState<any[]>([]);
  const [showReportsPosts, setShowReportsPosts] = useState(true);
  const [showUserLocation, setShowUserLocation] = useState(true);
  const [mapRegion, setMapRegion] = useState({ latitude: 12.061, longitude: 124.596, latitudeDelta: 0.25, longitudeDelta: 0.32 });
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
          if (updated.status === "in-progress" || updated.status === "resolved" || updated.status === "dismissed") {
            stopAlertForReport(updated.id);
          }
          if (updated.status === "pending") {
            playEmergencyAlert(updated);
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
      for (const r of reports) {
        prevReportIds.current.add(r.id);
        if (r.status === "pending") {
          playEmergencyAlert(r);
        }
      }
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
          (pos) => {
            setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
            if (typeof pos.coords.heading === "number") setUserHeading(pos.coords.heading);
          },
        );
      } catch (err) {
        if (!navigator.geolocation) return;
        const watchId = navigator.geolocation.watchPosition(
          (pos) => {
            setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
            if (typeof pos.coords.heading === "number") setUserHeading(pos.coords.heading);
          },
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
    upsertPoliceLocation(profile.id, activeReportId, userLocation.latitude, userLocation.longitude, userHeading)
      .catch(() => {});
  }, [profile?.id, userLocation, userHeading, activeReportId]);

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

  const reportsWithLocation = useMemo(
    () => reports.filter((r) => r.latitude && r.longitude),
    [reports],
  );

  const activeReportsWithLocation = useMemo(
    () => reportsWithLocation.filter((r) => ACTIVE_STATUSES.includes(r.status)),
    [reportsWithLocation],
  );

  const emergencyReports = activeReportsWithLocation.filter((r) => r.status === "pending");

  const visibleReports = activeReportsWithLocation;

  const scoredReports = useMemo(
    () => reports.map((r) => ({ ...r, _score: effectiveScore(r), _urgency: effectiveUrgency(r) })),
    [reports],
  );

  const firstResponseCount = scoredReports.filter((r) => FIRST_RESPONSE_STATUSES.includes(r.status)).length;
  const validatedCount = scoredReports.filter((r) => r.is_validated).length;
  const invalidCount = scoredReports.filter((r) => r.status === "dismissed").length;
  const criticalCount = scoredReports.filter((r) => r._urgency === "critical" && ACTIVE_STATUSES.includes(r.status)).length;
  const highCount = scoredReports.filter((r) => r._urgency === "high" && ACTIVE_STATUSES.includes(r.status)).length;

  const triageSorted = useMemo(() => {
    const filtered = scoredReports.filter((r) => {
      if (triageFilter === "first" && !FIRST_RESPONSE_STATUSES.includes(r.status)) return false;
      if (triageFilter === "critical" && !(ACTIVE_STATUSES.includes(r.status) && r._urgency === "critical")) return false;
      if (triageFilter === "high" && !(ACTIVE_STATUSES.includes(r.status) && r._urgency === "high")) return false;
      if (triageFilter === "validated" && !r.is_validated) return false;
      if (triageFilter === "dismissed" && r.status !== "dismissed") return false;
      return true;
    });
    return filtered.sort((a, b) => {
      const byUrgency = (URGENCY_ORDER[a._urgency] ?? 2) - (URGENCY_ORDER[b._urgency] ?? 2);
      if (byUrgency !== 0) return byUrgency;
      if (b._score !== a._score) return b._score - a._score;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [scoredReports, triageFilter]);
  useEffect(() => {
    if (emergencyReports.length === 0) return;
    const latest = emergencyReports[0];
    if (!latest?.latitude || !latest?.longitude) return;
    setMapRegion({
      latitude: latest.latitude,
      longitude: latest.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
  }, [emergencyReports.length]);

  const handleMarkerPress = (markerData: any) => {
    if (markerData.id) {
      const report = reports.find((r) => r.id === markerData.id);
      if (report) {
        router.push(`/report/${report.id}` as any);
        return;
      }
    }
    const report = visibleReports.find(
      (r) => r.latitude === markerData.coordinate.latitude && r.longitude === markerData.coordinate.longitude,
    );
    if (report) {
      router.push(`/report/${report.id}` as any);
      return;
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
        <View style={s.contentWrap}>
          {/* Report validation & triage */}
          <View style={s.triageSection}>
            <View style={s.triageHeader}>
              <View style={s.triageHeaderLeft}>
                <View style={s.triageHeaderIcon}>
                  <Ionicons name="shield-checkmark" size={18} color="#60A5FA" />
                </View>
                <View>
                  <Text style={s.triageTitle}>Report Validation</Text>
                  <Text style={s.triageSubtitle}>Auto-prioritized · {firstResponseCount} awaiting first response</Text>
                </View>
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.triageChips}>
              {[
                { key: "first", label: "Needs First Response", value: firstResponseCount, color: "#ef4444", icon: "megaphone-outline" as any },
                { key: "critical", label: "Critical Active", value: criticalCount, color: "#f87171", icon: "alert-circle" as any },
                { key: "high", label: "High Active", value: highCount, color: "#fb923c", icon: "flash" as any },
                { key: "validated", label: "Validated", value: validatedCount, color: "#10b981", icon: "checkmark-done-circle-outline" as any },
                { key: "dismissed", label: "Dismissed Invalid", value: invalidCount, color: "#64748b", icon: "close-circle-outline" as any },
              ].map((chip) => (
                <TouchableOpacity
                  key={chip.key}
                  style={[s.triageStatChip, triageFilter === chip.key && s.triageStatChipActive]}
                  onPress={() => setTriageFilter(chip.key as any)}
                >
                  <Ionicons name={chip.icon} size={13} color={triageFilter === chip.key ? chip.color : "rgba(255,255,255,0.45)"} />
                  <Text style={[s.triageStatLabel, triageFilter === chip.key && { color: chip.color, fontWeight: "800" }]}>{chip.label}</Text>
                  <View style={[s.triageStatValue, triageFilter === chip.key && { backgroundColor: chip.color }]}>
                    <Text style={[s.triageStatValueText, triageFilter === chip.key && { color: "#0f141a", fontWeight: "800" }]}>{chip.value}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {triageSorted.length === 0 ? (
              <View style={s.triageEmpty}>
                <Ionicons name="checkmark-done-circle-outline" size={28} color="rgba(255,255,255,0.2)" />
                <Text style={s.triageEmptyText}>No reports match this filter</Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.triageList}>
                {triageSorted.map((report) => {
                  const urgency = report._urgency;
                  const color = URGENCY_COLORS[urgency] || "#64748B";
                  const meta = statusColors[report.status] || statusColors.pending;
                  const icon = crimeIcons[report.crime_type] || "alert-circle";
                  const validation =
                    report.is_validated && !report.validated_by
                      ? { label: "Auto", color: "#f4b51a", bg: "rgba(244,181,26,0.14)" }
                      : report.is_validated
                        ? { label: "Validated", color: "#10b981", bg: "rgba(16,185,129,0.14)" }
                        : report.status === "dismissed"
                          ? { label: "Invalid", color: "#f87171", bg: "rgba(239,68,68,0.14)" }
                          : { label: "Pending", color: "#60a5fa", bg: "rgba(96,165,250,0.14)" };
                  return (
                    <TouchableOpacity
                      key={report.id}
                      style={s.triageCard}
                      activeOpacity={0.85}
                      onPress={() => router.push(`/report/${report.id}` as any)}
                    >
                      <View style={s.triageCardBody}>
                        <View style={s.triageCardTop}>
                          <View style={[s.triageIconWrap, { backgroundColor: `${color}1F` }]}>
                            <Ionicons name={icon as any} size={13} color={color} />
                          </View>
                          <Text style={s.triageCardType} numberOfLines={1}>{report.crime_type?.replace(/-/g, " ") || "Report"}</Text>
                          <View style={[s.triagePriorityBadge, { backgroundColor: `${color}22`, borderColor: `${color}66` }]}>
                            <Text style={[s.triagePriorityText, { color }]}>{urgency.toUpperCase()}</Text>
                          </View>
                        </View>
                        <View style={s.triageCardMeta}>
                          <Text style={[s.triageRowScore, { color }]}>{report._score}</Text>
                          <View style={[s.triageStatus, { backgroundColor: meta.bg }]}>
                            <Text style={[s.triageStatusText, { color: meta.text }]}>{report.status}</Text>
                          </View>
                          <View style={[s.triageValidBadge, { backgroundColor: validation.bg }]}>
                            <Text style={[s.triageValidText, { color: validation.color }]}>{validation.label}</Text>
                          </View>
                          <Text style={s.triageTime}>{timeAgo(report.created_at)}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>

          {/* Dispatch map */}
          <View style={s.mapContainer}>
            <View style={s.mapOverlayBottom}>
              <View style={s.mapStatsRow}>
                <View style={s.mapStat}>
                  <Ionicons name="alert-circle" size={10} color="#F87171" />
                  <Text style={s.mapStatValue}>{pendingReports}</Text>
                  <Text style={s.mapStatLabel}>Pending</Text>
                </View>
                <View style={s.mapStat}>
                  <Ionicons name="people" size={10} color="#60A5FA" />
                  <Text style={s.mapStatValue}>{totalResidents}</Text>
                  <Text style={s.mapStatLabel}>Residents</Text>
                </View>
                <View style={s.mapStat}>
                  <Ionicons name="document-text" size={10} color="#34D399" />
                  <Text style={s.mapStatValue}>{reports.length}</Text>
                  <Text style={s.mapStatLabel}>Reports</Text>
                </View>
              </View>
            </View>
          <View style={s.mapOverlayTop}>
            <View style={s.mapToggleRow}>
              <TouchableOpacity
                style={[s.mapToggleBtn, showReportsPosts && s.mapToggleBtnOnReports]}
                onPress={() => setShowReportsPosts(!showReportsPosts)}
                activeOpacity={0.8}
              >
                <Ionicons name="map" size={13} color={showReportsPosts ? "#0F141A" : "#93A5C4"} />
                <Text style={[s.mapToggleText, showReportsPosts && s.mapToggleTextOnReports]}>Reports &amp; Posts</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.mapToggleBtn, showUserLocation && s.mapToggleBtnOnLocation]}
                onPress={() => setShowUserLocation(!showUserLocation)}
                activeOpacity={0.8}
              >
                <Ionicons name="person" size={13} color={showUserLocation ? "#FFFFFF" : "#93A5C4"} />
                <Text style={[s.mapToggleText, showUserLocation && s.mapToggleTextOnLocation]}>My Location</Text>
              </TouchableOpacity>
            </View>
          </View>

          <MapView
            ref={mapRef}
            style={{ flex: 1 }}
            initialRegion={{ latitude: 12.061, longitude: 124.596, latitudeDelta: 0.25, longitudeDelta: 0.32 }}
            region={mapRegion}
            mapStyle="street"
            pitch={0}
            bearing={0}
            scrollEnabled
            zoomEnabled
            onMarkerPress={handleMarkerPress}
          >
            {showReportsPosts && visibleReports.map((report) => {
              const isPending = report.status === "pending";
              const isBackup = report.status === "needs-backup";
              const prioColor = URGENCY_COLORS[effectiveUrgency(report)] || "#F59E0B";
              return (
                <Marker
                  key={`rp-${report.id}`}
                  coordinate={{ latitude: report.latitude, longitude: report.longitude }}
                  pinColor={prioColor}
                  animate={isPending}
                  title={`${report.crime_type?.replace(/-/g, " ") || "Report"} — ${effectiveUrgency(report)} priority${isBackup ? " · BACKUP NEEDED" : ""}`}
                  clusterGroup="reports"
                  id={report.id}
                />
              );
            })}
            {showUserLocation && userLocation && (
              <Marker coordinate={userLocation} pinColor="#3B82F6">
                {profile?.photo_url || profile?.police_id_photo_url ? (
                  <Image source={{ uri: profile.photo_url || profile.police_id_photo_url! }} style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: "#fff" }} />
                ) : (
                  <Image source={Image.resolveAssetSource(require("../../assets/logo-black.png"))} style={{ width: 20, height: 20, borderRadius: 10 }} />
                )}
              </Marker>
            )}
            {showReportsPosts && policePosts.map((post) => {
              const safeName = post.name.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
              return (
                <Marker
                  key={`post-${post.id}`}
                  coordinate={{ latitude: post.latitude, longitude: post.longitude }}
                  markerHtml={
                    `<div style="position:absolute;bottom:calc(100% + 4px);left:50%;transform:translateX(-50%);background:#F4B51A;color:#0F141A;font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;white-space:nowrap;font-family:-apple-system,system-ui,sans-serif;box-shadow:0 1px 4px rgba(0,0,0,0.3);max-width:120px;overflow:hidden;text-overflow:ellipsis;">${safeName}</div>` +
                    `<div style="width:30px;height:30px;background:#0F1B33;border:2px solid #F4B51A;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.4);">` +
                    `<svg viewBox="0 0 24 24" fill="none" stroke="#F4B51A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>` +
                    `</div>`
                  }
                  popupHtml={`<div style="padding:4px 0;"><h4 style="display:flex;align-items:center;gap:6px;margin:0 0 4px 0;font-size:13px;"><svg viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>${safeName}</h4>${post.address ? `<p style="margin:0;font-size:11px;color:#64748b;">${post.address}</p>` : ""}</div>`}
                />
              );
            })}
          </MapView>
          </View>
        </View>
      )}
    </View>
  );
}
