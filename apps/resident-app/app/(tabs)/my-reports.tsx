import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Animated,
  StatusBar,
  ActivityIndicator,
  ScrollView,
  Image,
  Dimensions,
  Platform,
  TextInput,
  Alert,
  Modal,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "../../../../shared/supabase/supabaseClient";
import {
  fetchResidentReports,
  fetchReportFeedback,
  fetchActionUpdates,
  subscribeToReportUpdates,
  cancelReport,
  getActivePenalty,
  getCancelCount,
  appealPenalty,
} from "../../../../shared/services/reportService";
import { useMapStyle } from "../../context/MapStyleContext";
import MapView, { Marker, UrlTile } from "../../components/MapView";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const STATUS_META: Record<string, { bg: string; text: string; icon: string; label: string; accent: string; gradient: string[] }> = {
  pending: {
    bg: "#FEF3C7", text: "#D97706", icon: "time-outline", label: "Pending", accent: "#F59E0B",
    gradient: ["#FFF8E1", "#FFF3CD"],
  },
  "under-review": {
    bg: "#DBEAFE", text: "#2563EB", icon: "eye-outline", label: "Reviewing", accent: "#3B82F6",
    gradient: ["#E8F0FE", "#DBEAFE"],
  },
  "in-progress": {
    bg: "#EDE9FE", text: "#7C3AED", icon: "sync-outline", label: "In Progress", accent: "#8B5CF6",
    gradient: ["#F3EEFF", "#EDE9FE"],
  },
  resolved: {
    bg: "#D1FAE5", text: "#059669", icon: "checkmark-circle-outline", label: "Resolved", accent: "#10B981",
    gradient: ["#E6F9F0", "#D1FAE5"],
  },
  dismissed: {
    bg: "#F1F5F9", text: "#64748B", icon: "close-circle-outline", label: "Dismissed", accent: "#94A3B8",
    gradient: ["#F8FAFC", "#F1F5F9"],
  },
  cancelled: {
    bg: "#FEE2E2", text: "#DC2626", icon: "close-circle-outline", label: "Cancelled", accent: "#EF4444",
    gradient: ["#FEF2F2", "#FEE2E2"],
  },
};

const CRIME_ICONS: Record<string, string> = {
  "hit-and-run": "car-sport",
  robbery: "skull",
  theft: "bag-remove",
  assault: "alert-circle",
  vandalism: "hammer",
  burglary: "home-remove",
  others: "shield",
};

const CRIME_COLORS: Record<string, string> = {
  "hit-and-run": "#EF4444",
  robbery: "#7C3AED",
  theft: "#F59E0B",
  assault: "#DC2626",
  vandalism: "#0891B2",
  burglary: "#2563EB",
  others: "#64748B",
};

const FILTERS = [
  { id: "all", label: "All Reports", icon: "grid-outline" },
  { id: "pending", label: "Pending", icon: "time-outline" },
  { id: "under-review", label: "Reviewing", icon: "eye-outline" },
  { id: "in-progress", label: "In Progress", icon: "sync-outline" },
  { id: "resolved", label: "Resolved", icon: "checkmark-circle-outline" },
  { id: "dismissed", label: "Dismissed", icon: "close-circle-outline" },
  { id: "cancelled", label: "Cancelled", icon: "close-circle-outline" },
];

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-PH", {
    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function getTimeAgo(dateStr: string) {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function MyReportsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { tileUrl, mapStyle } = useMapStyle();
  const [reports, setReports] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selectedFilter, setSelectedFilter] = useState((params.filter as string) || "all");
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [reportFeedback, setReportFeedback] = useState<Record<string, any>>({});
  const [actionUpdates, setActionUpdates] = useState<Record<string, any[]>>({});
  const [loadingFeedback, setLoadingFeedback] = useState<Set<string>>(new Set());
  const subscriptionsRef = useRef<Record<string, any>>({});
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellingReport, setCancellingReport] = useState<any>(null);
  const [cancelResult, setCancelResult] = useState<{ penalty: string | null; cancel_count: number } | null>(null);
  const [showPenaltyModal, setShowPenaltyModal] = useState(false);
  const [activePenalty, setActivePenalty] = useState<any>(null);
  const [showAppealModal, setShowAppealModal] = useState(false);
  const [appealMessage, setAppealMessage] = useState("");
  const [submittingAppeal, setSubmittingAppeal] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  const expandAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadReports();
    return () => {
      Object.values(subscriptionsRef.current).forEach((sub) => {
        supabase.removeChannel(sub);
      });
    };
  }, []);

  const loadReports = async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError("");
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      if (!userId) { setError("Not logged in. Please sign in to view your reports."); return; }
      const data = await fetchResidentReports(userId);
      setReports(data);
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    } catch (e: any) {
      setError(e.message || "Failed to load reports.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const toggleExpand = (id: string) => {
    expandAnim.setValue(0);
    const isCollapsing = expandedReportId === id;
    setExpandedReportId(isCollapsing ? null : id);
    if (isCollapsing) {
      const sub = subscriptionsRef.current[id];
      if (sub) { supabase.removeChannel(sub); delete subscriptionsRef.current[id]; }
      return;
    }
    Animated.spring(expandAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }).start();
    loadReportDetails(id);
  };

  const loadReportDetails = async (reportId: string) => {
    try {
      setLoadingFeedback((prev) => new Set(prev).add(reportId));
      const feedback = await fetchReportFeedback(reportId);
      setReportFeedback((prev) => ({ ...prev, [reportId]: feedback }));
      const updates = await fetchActionUpdates(reportId);
      setActionUpdates((prev) => ({ ...prev, [reportId]: updates }));
      const subscription = subscribeToReportUpdates(reportId, (payload: any) => {
        if (payload.type === "feedback") {
          setReportFeedback((prev) => ({ ...prev, [reportId]: payload.data }));
        } else if (payload.type === "action_update") {
          setActionUpdates((prev) => ({
            ...prev,
            [reportId]: [...(prev[reportId] || []), payload.data].sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
            ),
          }));
        } else {
          setReports((prev) => prev.map((r) => (r.id === reportId ? payload : r)));
        }
      });
      subscriptionsRef.current[reportId] = subscription;
    } catch (err) {
      console.error("Failed to load report details:", err);
    } finally {
      setLoadingFeedback((prev) => { const u = new Set(prev); u.delete(reportId); return u; });
    }
  };

  const handleCancel = async () => {
    if (!cancellingReport) return;
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      if (!userId) return;
      const result = await cancelReport(cancellingReport.id, userId);
      setCancelResult(result);
      const data = await fetchResidentReports(userId);
      setReports(data);
      setShowCancelModal(false);
      setShowPenaltyModal(true);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to cancel report.");
    } finally {
      setCancellingReport(null);
    }
  };

  const handleAppeal = async () => {
    if (!appealMessage.trim() || !activePenalty) return;
    try {
      setSubmittingAppeal(true);
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      if (!userId) return;
      await appealPenalty(activePenalty.id, userId, appealMessage.trim());
      Alert.alert("Appeal Submitted", "Your appeal has been sent for review.");
      setShowAppealModal(false);
      setAppealMessage("");
      setActivePenalty(null);
      setShowPenaltyModal(false);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to submit appeal.");
    } finally {
      setSubmittingAppeal(false);
    }
  };

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    const status = item.status?.toLowerCase() || "pending";
    const statusMeta = STATUS_META[status] ?? STATUS_META["pending"];
    const crimeIcon = CRIME_ICONS[item.crime_type] ?? "alert-circle";
    const crimeColor = CRIME_COLORS[item.crime_type] ?? "#64748B";
    const isExpanded = expandedReportId === item.id;

    return (
      <Animated.View
        style={[
          styles.cardContainer,
          {
            opacity: fadeAnim,
            transform: [{
              translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [30 + index * 10, 0],
              }),
            }],
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.95}
          onPress={() => toggleExpand(item.id)}
          style={styles.card}
        >
          <View style={styles.cardInner}>
            {/* Accent stripe */}
            <View style={[styles.accentStripe, { backgroundColor: statusMeta.accent }]} />

            {/* Card Header */}
            <View style={styles.cardHeader}>
              <View style={[styles.crimeIconCircle, { backgroundColor: crimeColor + "15" }]}>
                <Ionicons name={crimeIcon as any} size={22} color={crimeColor} />
              </View>

              <View style={styles.headerContent}>
                <Text style={styles.crimeType}>
                  {item.crime_type
                    ? item.crime_type.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
                    : "Unknown Incident"}
                </Text>
                <View style={styles.headerMeta}>
                  <Ionicons name="time-outline" size={11} color="#94A3B8" />
                  <Text style={styles.reportDate}>{getTimeAgo(item.created_at)}</Text>
                </View>
              </View>

              <View style={[styles.statusBadge, { backgroundColor: statusMeta.bg }]}>
                <Ionicons name={statusMeta.icon as any} size={10} color={statusMeta.text} />
                <Text style={[styles.statusText, { color: statusMeta.text }]}>{statusMeta.label}</Text>
              </View>
            </View>

            {/* Quick preview when collapsed */}
            {!isExpanded && !!item.description && (
              <Text style={styles.descriptionCollapsed} numberOfLines={2}>
                {item.description}
              </Text>
            )}

            {/* Expanded Content */}
            {isExpanded && (
              <Animated.View
                style={[
                  styles.expandedSection,
                  {
                    opacity: expandAnim,
                    transform: [{
                      translateY: expandAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }),
                    }],
                  },
                ]}
              >
                <View style={styles.divider} />

                {/* Description */}
                {!!item.description && (
                  <View style={styles.expandedBlock}>
                    <Text style={styles.blockLabel}>Description</Text>
                    <Text style={styles.blockText}>{item.description}</Text>
                  </View>
                )}

                {/* Evidence Image */}
                {!!item.photo_url && (
                  <View style={styles.expandedBlock}>
                    <Text style={styles.blockLabel}>Evidence Photo</Text>
                    <View style={styles.imageFrame}>
                      <Image source={{ uri: item.photo_url }} style={styles.evidenceImage} resizeMode="cover" />
                    </View>
                  </View>
                )}

                {/* Location - Map instead of coordinates */}
                {item.latitude !== undefined && item.longitude !== undefined ? (
                  <View style={styles.expandedBlock}>
                    <Text style={styles.blockLabel}>Location</Text>
                    {!!item.location_address && (
                      <View style={styles.locationAddressRow}>
                        <Ionicons name="location" size={14} color="#3B82F6" />
                        <Text style={styles.locationAddressText}>{item.location_address}</Text>
                      </View>
                    )}
                    <View style={styles.mapContainer}>
                      <MapView
                        style={styles.map}
                        initialRegion={{
                          latitude: item.latitude,
                          longitude: item.longitude,
                          latitudeDelta: 0.01,
                          longitudeDelta: 0.01,
                        }}
                        mapStyle={mapStyle}
                        scrollEnabled={false}
                        zoomEnabled={false}
                        pointerEvents="none"
                      >
                        <UrlTile urlTemplate={tileUrl} />
                        <Marker
                          coordinate={{ latitude: item.latitude, longitude: item.longitude }}
                          pinColor={crimeColor}
                          title={item.crime_type ? item.crime_type.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") : "Incident"}
                        />
                      </MapView>
                    </View>
                  </View>
                ) : !!item.location_address ? (
                  <View style={styles.expandedBlock}>
                    <Text style={styles.blockLabel}>Location</Text>
                    <View style={styles.locationAddressRow}>
                      <Ionicons name="location" size={14} color="#3B82F6" />
                      <Text style={styles.locationAddressText}>{item.location_address}</Text>
                    </View>
                  </View>
                ) : null}

                {/* Police Feedback */}
                {loadingFeedback.has(item.id) ? (
                  <View style={styles.expandedBlock}>
                    <Text style={styles.blockLabel}>Police Response</Text>
                    <ActivityIndicator size="small" color="#8B5CF6" />
                  </View>
                ) : reportFeedback[item.id] ? (
                  <View style={styles.feedbackBlock}>
                    <View style={styles.feedbackHeader}>
                      <View style={styles.feedbackIconCircle}>
                        <Ionicons name="shield-checkmark" size={14} color="#10B981" />
                      </View>
                      <Text style={styles.feedbackTitle}>Police Response</Text>
                    </View>
                    {reportFeedback[item.id].officer_name && (
                      <View style={styles.feedbackRow}>
                        <Ionicons name="person-outline" size={13} color="#059669" />
                        <Text style={styles.feedbackValue}>{reportFeedback[item.id].officer_name}</Text>
                      </View>
                    )}
                    {reportFeedback[item.id].response_message && (
                      <View style={styles.feedbackRow}>
                        <Ionicons name="chatbubble-outline" size={13} color="#059669" />
                        <Text style={[styles.feedbackValue, { flex: 1 }]}>{reportFeedback[item.id].response_message}</Text>
                      </View>
                    )}
                    {reportFeedback[item.id].estimated_arrival && (
                      <View style={styles.feedbackRow}>
                        <Ionicons name="time-outline" size={13} color="#059669" />
                        <Text style={styles.feedbackValue}>ETA: {reportFeedback[item.id].estimated_arrival}</Text>
                      </View>
                    )}
                    {reportFeedback[item.id].created_at && (
                      <Text style={styles.feedbackTime}>{formatDate(reportFeedback[item.id].created_at)}</Text>
                    )}
                  </View>
                ) : null}

                {/* Action Timeline */}
                {actionUpdates[item.id] && actionUpdates[item.id].length > 0 && (
                  <View style={styles.expandedBlock}>
                    <Text style={styles.blockLabel}>Action Timeline</Text>
                    <View style={styles.timelineContainer}>
                      {actionUpdates[item.id].map((update, idx) => (
                        <View key={idx} style={styles.timelineItem}>
                          <View style={styles.timelineDot}>
                            <View style={[styles.timelineDotInner, { backgroundColor: statusMeta.accent }]} />
                          </View>
                          {idx < actionUpdates[item.id].length - 1 && <View style={[styles.timelineLine, { backgroundColor: statusMeta.accent + "30" }]} />}
                          <View style={styles.timelineContent}>
                            <Text style={styles.updateTitle}>{update.action_type}</Text>
                            {update.description && <Text style={styles.updateDescription}>{update.description}</Text>}
                            <Text style={styles.updateTime}>{formatDate(update.created_at)}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Reference ID */}
                <View style={styles.refRow}>
                  <Ionicons name="finger-print" size={12} color="#94A3B8" />
                  <Text style={styles.refText}>ID: {item.id?.toString().toUpperCase().slice(0, 8)}</Text>
                </View>

                {/* Action Buttons */}
                <View style={styles.actionButtons}>
                  {status === "in-progress" && (
                    <TouchableOpacity
                      style={styles.trackBtn}
                      onPress={() => router.push({ pathname: "/(tabs)/live-tracking" as any, params: { reportId: item.id } })}
                    >
                      <Ionicons name="navigate" size={16} color="#fff" />
                      <Text style={styles.trackBtnText}>Track Police</Text>
                    </TouchableOpacity>
                  )}
                  {status !== "cancelled" && status !== "resolved" && status !== "dismissed" && (
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={() => { setCancellingReport(item); setShowCancelModal(true); }}
                    >
                      <Ionicons name="close-circle-outline" size={15} color="#EF4444" />
                      <Text style={styles.cancelBtnText}>Cancel Report</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </Animated.View>
            )}

            {/* Expand indicator */}
            <View style={styles.expandIndicator}>
              <Ionicons
                name={isExpanded ? "chevron-up" : "chevron-down"}
                size={14}
                color="#CBD5E1"
              />
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const totalReports = reports.length;
  const pendingCount = reports.filter((r) => r.status?.toLowerCase() === "pending").length;
  const resolvedCount = reports.filter((r) => r.status?.toLowerCase() === "resolved").length;
  const inProgressCount = reports.filter((r) => r.status?.toLowerCase() === "in-progress").length;

  const filteredReports = reports.filter((item) => {
    if (selectedFilter === "all") return true;
    return item.status?.toLowerCase() === selectedFilter;
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <SafeAreaView edges={["top"]} style={styles.header}>
        <LinearGradient colors={["#17202b", "#1E293B"]} style={StyleSheet.absoluteFill} />
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTitleGroup}>
            <Text style={styles.headerTitle}>My Reports</Text>
            <Text style={styles.headerSub}>{totalReports} total incident{totalReports !== 1 ? "s" : ""}</Text>
          </View>
          <TouchableOpacity onPress={() => loadReports(true)} style={styles.headerBtn}>
            <Ionicons name="refresh" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Stats Bar */}
      {!isLoading && !error && (
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: "#818CF8" }]}>{totalReports}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: "#FCD34D" }]}>{pendingCount}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: "#A78BFA" }]}>{inProgressCount}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: "#34D399" }]}>{resolvedCount}</Text>
            <Text style={styles.statLabel}>Resolved</Text>
          </View>
        </View>
      )}

      {/* Filter Pills */}
      {!isLoading && !error && (
        <View style={styles.filterWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {FILTERS.map((f) => {
              const isActive = selectedFilter === f.id;
              return (
                <TouchableOpacity
                  key={f.id}
                  onPress={() => { setSelectedFilter(f.id); setExpandedReportId(null); }}
                  style={[styles.filterPill, isActive && styles.filterPillActive]}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={f.icon as any}
                    size={13}
                    color={isActive ? "#fff" : "#64748B"}
                    style={{ marginRight: 5 }}
                  />
                  <Text style={[styles.filterLabel, isActive && styles.filterLabelActive]}>{f.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Content */}
      {isLoading ? (
        <View style={styles.center}>
          <View style={styles.loadingPulse}>
            <Ionicons name="document-text-outline" size={40} color="#CBD5E1" />
          </View>
          <Text style={styles.loadingText}>Loading your reports...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <View style={styles.errorCircle}>
            <Ionicons name="alert-circle-outline" size={44} color="#EF4444" />
          </View>
          <Text style={styles.errorTitle}>Failed to Load</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => loadReports()}>
            <Ionicons name="refresh" size={16} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filteredReports.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="document-text" size={48} color="#CBD5E1" />
          </View>
          <Text style={styles.emptyTitle}>
            {selectedFilter === "all" ? "No Incident Records" : "No Match Found"}
          </Text>
          <Text style={styles.emptyText}>
            {selectedFilter === "all"
              ? "You haven't submitted any reports yet."
              : `No reports with "${selectedFilter}" status.`}
          </Text>
          <TouchableOpacity style={styles.goReportBtn} onPress={() => router.replace("/(tabs)/home" as any)}>
            <Ionicons name="add" size={20} color="#fff" style={{ marginRight: 4 }} />
            <Text style={styles.goReportText}>Submit a Report</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredReports}
          keyExtractor={(item) => item.id?.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadReports(true)}
              tintColor="#818CF8"
              colors={["#818CF8"]}
              progressBackgroundColor="#1E293B"
            />
          }
        />
      )}

      {/* Cancel Modal */}
      <Modal visible={showCancelModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={[styles.modalIconCircle, { backgroundColor: "#FEF2F2" }]}>
              <Ionicons name="warning" size={28} color="#EF4444" />
            </View>
            <Text style={styles.modalTitle}>Cancel Report?</Text>
            <Text style={styles.modalText}>
              This will mark your report as cancelled. Repeated cancellations may result in restrictions or a ban on submitting new reports.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { setShowCancelModal(false); setCancellingReport(null); }}>
                <Text style={styles.modalCancelText}>Keep Report</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleCancel}>
                <Text style={styles.modalConfirmText}>Yes, Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Penalty Modal */}
      <Modal visible={showPenaltyModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            {cancelResult?.penalty === "warning" && (
              <>
                <View style={[styles.modalIconCircle, { backgroundColor: "#FEF3C7" }]}>
                  <Ionicons name="alert-circle" size={28} color="#D97706" />
                </View>
                <Text style={styles.modalTitle}>Warning</Text>
                <Text style={styles.modalText}>This is your 1st cancellation. Please be mindful — further cancellations may lead to restrictions.</Text>
              </>
            )}
            {cancelResult?.penalty === "restriction" && (
              <>
                <View style={[styles.modalIconCircle, { backgroundColor: "#FEE2E2" }]}>
                  <Ionicons name="ban" size={28} color="#DC2626" />
                </View>
                <Text style={styles.modalTitle}>Account Restricted</Text>
                <Text style={styles.modalText}>You have cancelled 2 reports. Your account is now restricted from submitting new reports. You may appeal.</Text>
              </>
            )}
            {cancelResult?.penalty === "ban" && (
              <>
                <View style={[styles.modalIconCircle, { backgroundColor: "#FEE2E2" }]}>
                  <Ionicons name="bug" size={28} color="#DC2626" />
                </View>
                <Text style={styles.modalTitle}>Account Banned</Text>
                <Text style={styles.modalText}>You have cancelled 3+ reports. Your account has been banned from submitting reports. You may appeal.</Text>
              </>
            )}
            {!cancelResult?.penalty && (
              <>
                <View style={[styles.modalIconCircle, { backgroundColor: "#D1FAE5" }]}>
                  <Ionicons name="checkmark-circle" size={28} color="#059669" />
                </View>
                <Text style={styles.modalTitle}>Report Cancelled</Text>
                <Text style={styles.modalText}>Your report has been cancelled successfully.</Text>
              </>
            )}
            <View style={styles.modalActions}>
              {cancelResult?.penalty === "restriction" || cancelResult?.penalty === "ban" ? (
                <>
                  <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { setShowPenaltyModal(false); setCancelResult(null); }}>
                    <Text style={styles.modalCancelText}>Close</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalConfirmBtn} onPress={async () => {
                    const { data: session } = await supabase.auth.getSession();
                    const uid = session?.session?.user?.id;
                    if (uid) { const p = await getActivePenalty(uid); setActivePenalty(p); }
                    setShowPenaltyModal(false);
                    setShowAppealModal(true);
                  }}>
                    <Text style={styles.modalConfirmText}>Appeal</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity style={styles.modalConfirmBtn} onPress={() => { setShowPenaltyModal(false); setCancelResult(null); }}>
                  <Text style={styles.modalConfirmText}>OK</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Appeal Modal */}
      <Modal visible={showAppealModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={[styles.modalIconCircle, { backgroundColor: "#DBEAFE" }]}>
              <Ionicons name="chatbubble-ellipses" size={28} color="#2563EB" />
            </View>
            <Text style={styles.modalTitle}>Submit Appeal</Text>
            <Text style={styles.modalText}>
              Explain why you believe the penalty should be removed. A review will be conducted by the Calbayog City Police Department.
            </Text>
            <TextInput
              style={styles.appealInput}
              placeholder="Write your appeal here..."
              placeholderTextColor="#94A3B8"
              multiline
              value={appealMessage}
              onChangeText={setAppealMessage}
              textAlignVertical="top"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { setShowAppealModal(false); setAppealMessage(""); setActivePenalty(null); }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, (!appealMessage.trim() || submittingAppeal) && { opacity: 0.5 }]}
                onPress={handleAppeal}
                disabled={!appealMessage.trim() || submittingAppeal}
              >
                {submittingAppeal ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalConfirmText}>Submit Appeal</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },
  header: {
    backgroundColor: "#17202b",
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitleGroup: {
    alignItems: "center",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  headerSub: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },
  statsBar: {
    flexDirection: "row",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 14,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "800",
  },
  statLabel: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "600",
    marginTop: 3,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    backgroundColor: "#F1F5F9",
    alignSelf: "stretch",
  },
  filterWrapper: {
    paddingVertical: 12,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  filterPillActive: {
    backgroundColor: "#17202b",
    borderColor: "#17202b",
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
  filterLabelActive: {
    color: "#fff",
  },
  list: {
    padding: 16,
    paddingTop: 4,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  loadingPulse: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  loadingText: {
    marginTop: 8,
    color: "#64748B",
    fontSize: 14,
    fontWeight: "600",
  },
  errorCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#FEF2F2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1E293B",
  },
  errorText: {
    color: "#64748B",
    fontSize: 13,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 20,
  },
  retryBtn: {
    marginTop: 18,
    backgroundColor: "#17202b",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  retryText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  emptyText: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  goReportBtn: {
    marginTop: 24,
    backgroundColor: "#17202b",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  goReportText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 13,
  },
  cardContainer: {
    marginBottom: 14,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  cardInner: {
    padding: 16,
  },
  accentStripe: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  crimeIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  headerContent: {
    flex: 1,
    marginLeft: 12,
  },
  crimeType: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: -0.2,
  },
  headerMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
    gap: 4,
  },
  reportDate: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "500",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  descriptionCollapsed: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 12,
    lineHeight: 18,
  },
  expandedSection: {
    marginTop: 14,
  },
  divider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginBottom: 14,
  },
  expandedBlock: {
    marginBottom: 16,
  },
  blockLabel: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  blockText: {
    fontSize: 13,
    color: "#334155",
    lineHeight: 20,
  },
  imageFrame: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    height: 180,
  },
  evidenceImage: {
    width: "100%",
    height: "100%",
  },
  locationAddressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginBottom: 10,
    backgroundColor: "#F8FAFC",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  locationAddressText: {
    fontSize: 12,
    color: "#334155",
    flex: 1,
    lineHeight: 17,
  },
  mapContainer: {
    height: 160,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  map: {
    flex: 1,
  },
  feedbackBlock: {
    backgroundColor: "#F0FDF4",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    borderLeftWidth: 3,
    borderLeftColor: "#10B981",
    marginBottom: 16,
  },
  feedbackIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#D1FAE5",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  feedbackHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  feedbackTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#059669",
  },
  feedbackRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
    gap: 8,
  },
  feedbackValue: {
    fontSize: 12,
    color: "#1F2937",
    lineHeight: 18,
  },
  feedbackTime: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 8,
    marginLeft: 36,
  },
  timelineContainer: {
    marginTop: 4,
    paddingLeft: 4,
  },
  timelineItem: {
    flexDirection: "row",
    marginBottom: 4,
    position: "relative",
  },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  timelineDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  timelineLine: {
    position: "absolute",
    left: 11.5,
    top: 24,
    bottom: -4,
    width: 2,
  },
  timelineContent: {
    flex: 1,
    marginLeft: 12,
    paddingBottom: 16,
  },
  updateTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0F172A",
    textTransform: "capitalize",
  },
  updateDescription: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
    lineHeight: 16,
  },
  updateTime: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 4,
  },
  refRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F8FAFC",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 12,
  },
  refText: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    letterSpacing: 0.5,
  },
  actionButtons: {
    gap: 8,
  },
  trackBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#7C3AED",
    gap: 8,
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  trackBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
    gap: 6,
  },
  cancelBtnText: {
    color: "#DC2626",
    fontSize: 13,
    fontWeight: "600",
  },
  expandIndicator: {
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 8,
    marginTop: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  modalBox: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
  },
  modalIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 8,
  },
  modalText: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#17202b",
    alignItems: "center",
  },
  modalConfirmText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#fff",
  },
  appealInput: {
    width: "100%",
    minHeight: 100,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: "#0F172A",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 16,
    lineHeight: 20,
  },
});
