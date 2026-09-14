import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Image,
  Modal,
  TextInput,
  Alert,
  Dimensions,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { VideoView, useVideoPlayer } from "expo-video";
import { supabase } from "../../../shared/supabase/supabaseClient";
import {
  fetchResidentReport,
  fetchReportFeedback,
  fetchActionUpdates,
  subscribeToReportUpdates,
  cancelReport,
  getActivePenalty,
  appealPenalty,
} from "../../../shared/services/reportService";
import {
  STATUS_META,
  CRIME_ICONS,
  CRIME_COLORS,
  formatDate,
  getTimeAgo,
  parseEvidenceUrls,
  isVideoUrl,
} from "../constants/reportMeta";
import { ReportMapPreview } from "../components/ReportMapPreview";

const SCREEN_WIDTH = Dimensions.get("window").width;

function ViewerVideo({ url, shouldPlay }: { url: string; shouldPlay: boolean }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
  });
  useEffect(() => {
    if (shouldPlay) {
      player.play();
    }
  }, [shouldPlay, player]);
  return (
    <VideoView
      player={player}
      style={{ width: "100%", height: "70%" }}
      contentFit="contain"
      nativeControls
    />
  );
}

export default function ReportDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const reportId = (params.id as string) || "";

  const [report, setReport] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [reportFeedback, setReportFeedback] = useState<any>(null);
  const [actionUpdates, setActionUpdates] = useState<any[]>([]);
  const [loadingFeedback, setLoadingFeedback] = useState(false);

  const [viewerUrls, setViewerUrls] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerVisible, setViewerVisible] = useState(false);

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelResult, setCancelResult] = useState<{ penalty: string | null; cancel_count: number } | null>(null);
  const [showPenaltyModal, setShowPenaltyModal] = useState(false);
  const [activePenalty, setActivePenalty] = useState<any>(null);
  const [showAppealModal, setShowAppealModal] = useState(false);
  const [appealMessage, setAppealMessage] = useState("");
  const [submittingAppeal, setSubmittingAppeal] = useState(false);

  const loadReport = async () => {
    setIsLoading(true);
    setError("");
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      if (!userId) { setError("Not signed in. Please sign in to continue."); return; }
      const data = await fetchResidentReport(userId, reportId);
      if (!data) { setError("Report not found."); return; }
      setReport(data);
    } catch (e: any) {
      setError(e.message || "Failed to load report.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [reportId]);

  useEffect(() => {
    if (!reportId) return;
    let alive = true;

    const loadDetails = async () => {
      setLoadingFeedback(true);
      try {
        const [feedback, updates] = await Promise.all([
          fetchReportFeedback(reportId),
          fetchActionUpdates(reportId),
        ]);
        if (!alive) return;
        setReportFeedback(feedback);
        setActionUpdates(updates);
      } catch {
        /* ignore */
      } finally {
        if (alive) setLoadingFeedback(false);
      }
    };
    loadDetails();

    const sub = subscribeToReportUpdates(reportId, (payload: any) => {
      if (!alive) return;
      if (payload.type === "feedback") {
        setReportFeedback(payload.data);
      } else if (payload.type === "action_update") {
        setActionUpdates((prev) =>
          [...prev, payload.data].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
          ),
        );
      } else {
        setReport((prev: any) => (prev && prev.id === reportId ? { ...prev, ...payload } : prev));
      }
    });

    return () => {
      alive = false;
      if (sub) supabase.removeChannel(sub);
    };
  }, [reportId]);

  const handleCancel = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      if (!userId) return;
      const result = await cancelReport(reportId, userId);
      setCancelResult(result);
      if (reportId) {
        const data = await fetchResidentReport(userId, reportId);
        if (data) setReport(data);
      }
      setShowCancelModal(false);
      setShowPenaltyModal(true);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to cancel report.");
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

  const status = report?.status?.toLowerCase() || "pending";
  const statusMeta = STATUS_META[status] ?? STATUS_META["pending"];
  const crimeIcon = CRIME_ICONS[report?.crime_type] ?? "alert-circle";
  const crimeColor = CRIME_COLORS[report?.crime_type] ?? "#64748B";
  const crimeLabel = report?.crime_type
    ? report.crime_type.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
    : "Unknown Incident";
  const evidenceUrls = report ? parseEvidenceUrls(report.photo_url) : [];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <SafeAreaView edges={["top"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTitleGroup}>
            <Text style={styles.headerTitle}>Report Details</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>
      </SafeAreaView>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0F204B" />
          <Text style={styles.loadingText}>Loading report...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <View style={styles.errorCircle}>
            <Ionicons name="alert-circle-outline" size={44} color="#EF4444" />
          </View>
          <Text style={styles.errorTitle}>Failed to Load</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => loadReport()}>
            <Ionicons name="refresh" size={16} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : report ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          bounces={false}
        >
          {/* Hero Card */}
          <View style={styles.heroCardShadow}>
            <View style={styles.heroCard}>
              <View style={styles.heroBody}>
                <View style={[styles.crimeIconCircle, { backgroundColor: crimeColor + "1A" }]}>
                  <Ionicons name={crimeIcon as any} size={32} color={crimeColor} />
                </View>
                <Text style={styles.heroCrimeType}>{crimeLabel}</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusMeta.bg, borderColor: statusMeta.text + "2E" }]}>
                  {status === "in-progress" && <View style={styles.statusLiveDot} />}
                  <Ionicons name={statusMeta.icon as any} size={12} color={statusMeta.text} />
                  <Text style={[styles.statusText, { color: statusMeta.text }]}>{statusMeta.label}</Text>
                </View>
                <View style={styles.heroDateRow}>
                  <Ionicons name="calendar-outline" size={13} color="#94A3B8" />
                  <Text style={styles.heroDate}>{formatDate(report.created_at)}</Text>
                  <Text style={styles.headerDot}>{"\u2022"}</Text>
                  <Text style={styles.heroDate}>{getTimeAgo(report.created_at)}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Description */}
          {!!report.description && (
            <View style={styles.block}>
              <Text style={styles.blockLabel}>Description</Text>
              <Text style={styles.blockText}>{report.description}</Text>
            </View>
          )}

          {/* Evidence */}
          {evidenceUrls.length > 0 && (
            <View style={styles.block}>
              <Text style={styles.blockLabel}>Evidence ({evidenceUrls.length})</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.evidenceRow}>
                {evidenceUrls.map((url: string, idx: number) => (
                  <TouchableOpacity
                    key={idx}
                    activeOpacity={0.8}
                    onPress={() => {
                      setViewerUrls(evidenceUrls);
                      setViewerIndex(idx);
                      setViewerVisible(true);
                    }}
                    style={styles.imageFrame}
                  >
                    {isVideoUrl(url) ? (
                      <View style={[styles.evidenceImg, { backgroundColor: "#1E293B", justifyContent: "center", alignItems: "center" }]}>
                        <Ionicons name="play-circle" size={34} color="#fff" />
                        <Text style={styles.videoTag}>Video</Text>
                      </View>
                    ) : (
                      <Image source={{ uri: url }} style={styles.evidenceImg} resizeMode="cover" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Location */}
          {report.latitude != null && report.longitude != null ? (
            <View style={styles.block}>
              <Text style={styles.blockLabel}>Location</Text>
              <View style={styles.mapContainer}>
                <ReportMapPreview
                  latitude={Number(report.latitude)}
                  longitude={Number(report.longitude)}
                  markerColor={crimeColor}
                />
                {!!report.location_address && (
                  <View style={styles.mapAddressChip}>
                    <View style={styles.mapAddressIconCircle}>
                      <Ionicons name="location" size={11} color="#fff" />
                    </View>
                    <Text style={styles.mapAddressText} numberOfLines={2}>{report.location_address}</Text>
                  </View>
                )}
              </View>
            </View>
          ) : !!report.location_address ? (
            <View style={styles.block}>
              <Text style={styles.blockLabel}>Location</Text>
              <View style={styles.addressRow}>
                <Ionicons name="location" size={14} color="#3B82F6" />
                <Text style={styles.addressText}>{report.location_address}</Text>
              </View>
            </View>
          ) : null}

          {/* Police Feedback */}
          <View style={styles.block}>
            <Text style={styles.blockLabel}>Police Response</Text>
            {loadingFeedback ? (
              <View style={styles.loadingFeedback}>
                <ActivityIndicator size="small" color="#10B981" />
              </View>
            ) : reportFeedback?.officer_name || reportFeedback?.response_message || reportFeedback?.estimated_arrival ? (
              <View style={styles.feedbackBlock}>
                <View style={styles.feedbackHeader}>
                  <View style={styles.feedbackIconCircle}>
                    <Ionicons name="shield-checkmark" size={14} color="#10B981" />
                  </View>
                  <Text style={styles.feedbackTitle}>Police Response</Text>
                </View>
                {reportFeedback.officer_name && (
                  <View style={styles.feedbackRow}>
                    <Ionicons name="person-outline" size={13} color="#059669" />
                    <Text style={styles.feedbackValue}>{reportFeedback.officer_name}</Text>
                  </View>
                )}
                {reportFeedback.response_message && (
                  <View style={styles.feedbackRow}>
                    <Ionicons name="chatbubble-outline" size={13} color="#059669" />
                    <Text style={[styles.feedbackValue, { flex: 1 }]}>{reportFeedback.response_message}</Text>
                  </View>
                )}
                {reportFeedback.estimated_arrival && (
                  <View style={styles.feedbackRow}>
                    <Ionicons name="time-outline" size={13} color="#059669" />
                    <Text style={styles.feedbackValue}>ETA: {reportFeedback.estimated_arrival}</Text>
                  </View>
                )}
                {reportFeedback.created_at && (
                  <Text style={styles.feedbackTime}>{formatDate(reportFeedback.created_at)}</Text>
                )}
              </View>
            ) : (
              <View style={styles.noResponseRow}>
                <Ionicons name="time-outline" size={14} color="#94A3B8" />
                <Text style={styles.noResponseText}>No response yet. The police will update this report.</Text>
              </View>
            )}
          </View>

          {/* Action Timeline */}
          {actionUpdates.length > 0 && (
            <View style={styles.block}>
              <Text style={styles.blockLabel}>Action Timeline</Text>
              <View style={styles.timelineContainer}>
                {actionUpdates.map((update, idx) => (
                  <View key={idx} style={styles.timelineItem}>
                    <View style={styles.timelineDot}>
                      <View style={[styles.timelineDotInner, { backgroundColor: statusMeta.accent }]} />
                    </View>
                    {idx < actionUpdates.length - 1 && <View style={[styles.timelineLine, { backgroundColor: statusMeta.accent + "30" }]} />}
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
            <Ionicons name="finger-print" size={13} color="#94A3B8" />
            <Text style={styles.refText}>Ref ID: {report.id?.toString().toUpperCase().slice(0, 8)}</Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            {status === "in-progress" && (
              <TouchableOpacity
                style={styles.trackBtn}
                onPress={() => router.push({ pathname: "/(tabs)/live-tracking" as any, params: { reportId } } as any)}
              >
                <View style={styles.trackLiveDot} />
                <Ionicons name="navigate" size={18} color="#fff" />
                <Text style={styles.trackBtnText}>Track Police</Text>
              </TouchableOpacity>
            )}
            {status !== "cancelled" && status !== "resolved" && status !== "dismissed" && (
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowCancelModal(true)}
              >
                <Ionicons name="close-circle-outline" size={15} color="#EF4444" />
                <Text style={styles.cancelBtnText}>Cancel Report</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      ) : null}

      {/* Cancel Modal */}
      <Modal visible={showCancelModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={[styles.modalIconCircle, { backgroundColor: "#FEE2E2" }]}>
              <Ionicons name="warning" size={28} color="#DC2626" />
            </View>
            <Text style={styles.modalTitle}>Cancel Report</Text>
            <Text style={styles.modalText}>
              Are you sure you want to cancel this report? Repeated cancellations may result in account restrictions.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowCancelModal(false)}>
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

      {/* Evidence Viewer Modal */}
      <Modal visible={viewerVisible} transparent animationType="fade" onRequestClose={() => setViewerVisible(false)}>
        <View style={styles.viewerOverlay}>
          <StatusBar backgroundColor="#1E293B" barStyle="light-content" />
          <TouchableOpacity style={styles.viewerCloseBtn} onPress={() => setViewerVisible(false)}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.viewerCounter}>
            {viewerIndex + 1} / {viewerUrls.length}
          </Text>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              setViewerIndex(idx);
            }}
          >
            {viewerUrls.map((url: string, idx: number) => (
              <View key={idx} style={styles.viewerPage}>
                {isVideoUrl(url) ? (
                  <ViewerVideo url={url} shouldPlay={idx === viewerIndex} />
                ) : (
                  <Image source={{ uri: url }} style={styles.viewerImage} resizeMode="contain" />
                )}
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    backgroundColor: "#0F204B",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: {
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
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  headerSpacer: {
    width: 36,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
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
    backgroundColor: "#0F204B",
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
  heroCardShadow: {
    borderRadius: 18,
    marginBottom: 16,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 26,
    elevation: 10,
  },
  heroCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    overflow: "hidden",
  },
  heroBody: {
    alignItems: "center",
    padding: 20,
  },
  crimeIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(15, 32, 75, 0.08)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  heroCrimeType: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.4,
    textAlign: "center",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 5,
    borderWidth: 1.5,
    marginTop: 10,
  },
  statusLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#EF4444",
    marginRight: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  heroDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 8,
  },
  heroDate: {
    fontSize: 12,
    color: "#94A3B8",
    fontWeight: "500",
  },
  headerDot: {
    fontSize: 12,
    color: "#CBD5E1",
    marginHorizontal: 2,
  },
  block: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  blockLabel: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  blockText: {
    fontSize: 13,
    color: "#334155",
    lineHeight: 20,
  },
  evidenceRow: {
    gap: 8,
  },
  imageFrame: {
    borderRadius: 12,
    overflow: "hidden",
    height: 110,
    width: 130,
    borderWidth: 1,
    borderColor: "#EEF2F7",
  },
  evidenceImg: {
    width: "100%",
    height: "100%",
  },
  videoTag: {
    fontSize: 10,
    color: "#fff",
    fontWeight: "700",
    marginTop: 4,
  },
  mapContainer: {
    height: 180,
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
  },
  mapAddressChip: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  mapAddressIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
  },
  mapAddressText: {
    flex: 1,
    fontSize: 12,
    color: "#1E293B",
    fontWeight: "600",
    lineHeight: 16,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 10,
  },
  addressText: {
    flex: 1,
    fontSize: 12,
    color: "#334155",
    lineHeight: 17,
  },
  loadingFeedback: {
    paddingVertical: 16,
    alignItems: "center",
  },
  noResponseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 10,
  },
  noResponseText: {
    flex: 1,
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
    lineHeight: 17,
  },
  feedbackBlock: {
    backgroundColor: "#F0FDF4",
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: "#10B981",
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
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  refText: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
    fontFamily: "monospace",
    letterSpacing: 0.5,
  },
  actionButtons: {
    gap: 8,
  },
  trackLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#fff",
  },
  trackBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#DC2626",
    gap: 8,
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  trackBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#FEF2F2",
    gap: 6,
  },
  cancelBtnText: {
    color: "#DC2626",
    fontSize: 13,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 32, 75, 0.6)",
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
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
    backgroundColor: "#F1F5F9",
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
    backgroundColor: "#0F204B",
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
    marginBottom: 16,
    lineHeight: 20,
  },
  viewerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  viewerCloseBtn: {
    position: "absolute",
    top: 50,
    right: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  viewerCounter: {
    position: "absolute",
    top: 55,
    left: 0,
    right: 0,
    textAlign: "center",
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    zIndex: 10,
  },
  viewerPage: {
    width: SCREEN_WIDTH,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  viewerImage: {
    width: "100%",
    height: "80%",
  },
});