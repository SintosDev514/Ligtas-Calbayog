import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Animated,
  StatusBar,
  Platform,
  KeyboardAvoidingView,
  Image,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
} from "expo-camera";
import { supabase } from "../../../shared/supabase/supabaseClient";
import {
  submitCrimeReport,
  getActivePenalty,
} from "../../../shared/services/reportService";
import { useLocation } from "../context/LocationContext";

export default function EmergencyReportScreen() {
  const router = useRouter();
  const { location } = useLocation();

  const [description, setDescription] = useState("");
  const [capturedMedia, setCapturedMedia] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedId, setSubmittedId] = useState("");

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const cameraRef = useRef<CameraView>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  const openCamera = async () => {
    if (!cameraPermission?.granted) {
      const response = await requestCameraPermission();
      if (!response.granted) {
        Alert.alert("Permission Required", "Camera permission denied.");
        return;
      }
    }
    if (!micPermission?.granted) {
      await requestMicPermission();
    }
    setIsCameraOpen(true);
  };

  const takePhoto = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      if (photo?.uri) {
        setCapturedMedia((prev) => [...prev, { uri: photo.uri, type: "image" as const }]);
      }
    } catch {
      Alert.alert("Error", "Failed to capture image.");
    } finally {
      setIsCameraOpen(false);
    }
  };

  const removeMedia = (index: number) => {
    setCapturedMedia((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadReportMedia = async (uri: string, type: "image" | "video") => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const ext = type === "video" ? "mp4" : "jpg";
      const filename = `emergency-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      const contentType = type === "video" ? "video/mp4" : "image/jpeg";

      const { error } = await supabase.storage
        .from("report-photos")
        .upload(filename, blob, { contentType });

      if (error) return null;

      const { data } = supabase.storage
        .from("report-photos")
        .getPublicUrl(filename);

      return data.publicUrl;
    } catch {
      return null;
    }
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);

      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;

      if (!userId) {
        Alert.alert("Error", "Please login first.");
        setIsSubmitting(false);
        return;
      }

      const penalty = await getActivePenalty(userId);
      if (penalty) {
        if (penalty.type === "restriction") {
          Alert.alert("Account Restricted", "Your account is currently restricted.");
          setIsSubmitting(false);
          return;
        }
        if (penalty.type === "ban") {
          Alert.alert("Account Banned", "Your account has been banned from submitting reports.");
          setIsSubmitting(false);
          return;
        }
      }

      let photoUrl: string | undefined;
      if (capturedMedia.length > 0) {
        const uploadPromises = capturedMedia.map((item) =>
          uploadReportMedia(item.uri, item.type),
        );
        const urls = await Promise.all(uploadPromises);
        const validUrls = urls.filter(Boolean);
        if (validUrls.length > 0) {
          photoUrl = validUrls.join(",");
        }
      }

      const result = await submitCrimeReport({
        userId,
        crimeType: "emergency",
        description: description || "Emergency SOS report",
        latitude: location?.latitude,
        longitude: location?.longitude,
        locationAddress: location?.address,
        photoUrl: photoUrl as any,
      });

      setSubmittedId(result?.id?.toString() ?? "");
      setSubmitted(true);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to submit emergency report.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <View style={styles.submittedContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#7F1D1D" />
        <LinearGradient colors={["#7F1D1D", "#450A0A"]} style={styles.submittedGradient}>
          <Animated.View style={[styles.submittedContent, { opacity: fadeAnim }]}>
            <View style={styles.successIconWrap}>
              <Ionicons name="checkmark-circle" size={72} color="#4ADE80" />
            </View>
            <Text style={styles.submittedTitle}>Emergency Report Sent</Text>
            <Text style={styles.submittedSub}>
              Authorities have been notified of your location.
            </Text>
            {submittedId ? (
              <Text style={styles.submittedId}>Ref: {submittedId.slice(0, 8)}...</Text>
            ) : null}

            <View style={styles.stayCalmCard}>
              <Ionicons name="information-circle" size={20} color="#FCD34D" />
              <Text style={styles.stayCalmText}>
                Stay calm and remain where you are if safe. A responder will be dispatched to your location.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.backHomeBtn}
              onPress={() => router.back()}
            >
              <Text style={styles.backHomeBtnText}>Back to Dashboard</Text>
            </TouchableOpacity>
          </Animated.View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#7F1D1D" />
      <SafeAreaView edges={["top"]} style={styles.headerSafe}>
        <LinearGradient colors={["#7F1D1D", "#991B1B"]} style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Emergency Report</Text>
            <Text style={styles.headerSub}>Immediate police assistance</Text>
          </View>
          <Ionicons name="warning" size={22} color="#FCA5A5" />
        </LinearGradient>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Location */}
          <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="location" size={18} color="#EF4444" />
              <Text style={styles.cardTitle}>Current Location</Text>
            </View>
            <View style={styles.locationBody}>
              <View style={styles.locationRow}>
                <Text style={styles.locationLabel}>Latitude</Text>
                <Text style={styles.locationValue}>
                  {location?.latitude?.toFixed(6) ?? "Acquiring..."}
                </Text>
              </View>
              <View style={styles.locationRow}>
                <Text style={styles.locationLabel}>Longitude</Text>
                <Text style={styles.locationValue}>
                  {location?.longitude?.toFixed(6) ?? "Acquiring..."}
                </Text>
              </View>
              {location?.address && (
                <View style={styles.locationRow}>
                  <Text style={styles.locationLabel}>Address</Text>
                  <Text style={[styles.locationValue, { flex: 1 }]} numberOfLines={2}>
                    {location.address}
                  </Text>
                </View>
              )}
              <View style={styles.locationLiveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.locationLiveText}>Live GPS tracking active</Text>
              </View>
            </View>
          </Animated.View>

          {/* Evidence */}
          <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="camera" size={18} color="#EF4444" />
              <Text style={styles.cardTitle}>Attach Evidence</Text>
              <Text style={styles.cardOptional}>Optional</Text>
            </View>

            {capturedMedia.length > 0 ? (
              <View style={styles.mediaRow}>
                {capturedMedia.map((item, index) => (
                  <View key={index} style={styles.mediaThumbWrap}>
                    <Image source={{ uri: item.uri }} style={styles.mediaThumb} />
                    <TouchableOpacity
                      style={styles.mediaRemove}
                      onPress={() => removeMedia(index)}
                    >
                      <Ionicons name="close-circle" size={22} color="#DC2626" />
                    </TouchableOpacity>
                    {item.type === "video" && (
                      <View style={styles.videoBadge}>
                        <Ionicons name="videocam" size={12} color="#FFFFFF" />
                      </View>
                    )}
                  </View>
                ))}
                <TouchableOpacity style={styles.addMediaBtn} onPress={openCamera}>
                  <Ionicons name="camera" size={24} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.evidenceAdd} onPress={openCamera}>
                <Ionicons name="camera-outline" size={28} color="#EF4444" />
                <Text style={styles.evidenceAddText}>Tap to capture photo evidence</Text>
              </TouchableOpacity>
            )}
          </Animated.View>

          {/* Incident Details */}
          <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="document-text" size={18} color="#EF4444" />
              <Text style={styles.cardTitle}>Incident Details</Text>
              <Text style={styles.cardOptional}>Optional</Text>
            </View>
            <TextInput
              style={styles.textInput}
              placeholder="Describe what is happening..."
              placeholderTextColor="#6B7280"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              maxLength={500}
            />
            <Text style={styles.charCount}>{description.length}/500</Text>
          </Animated.View>

          {/* Legal Advisory */}
          <Animated.View style={[styles.legalCard, { opacity: fadeAnim }]}>
            <View style={styles.legalHeader}>
              <Ionicons name="gavel" size={18} color="#FCD34D" />
              <Text style={styles.legalTitle}>Legal Advisory</Text>
            </View>
            <Text style={styles.legalText}>
              Under Presidential Decree No. 1727, filing a false emergency report is strictly
              illegal and subject to imprisonment and heavy fines. Only use this feature in
              genuine life-threatening emergencies.
            </Text>
          </Animated.View>

          {/* Submit Button */}
          <Animated.View style={[styles.submitWrap, { opacity: fadeAnim }]}>
            <TouchableOpacity
              style={styles.submitBtn}
              activeOpacity={0.8}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              <LinearGradient
                colors={["#DC2626", "#991B1B"]}
                style={styles.submitGradient}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="warning" size={20} color="#FFFFFF" />
                    <Text style={styles.submitText}>Submit Emergency Report</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
            <Text style={styles.submitHint}>
              Your live GPS location will be shared with authorities
            </Text>
          </Animated.View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Camera Modal */}
      {isCameraOpen && (
        <View style={styles.cameraModal}>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="back"
          >
            <View style={styles.cameraOverlay}>
              <TouchableOpacity
                style={styles.cameraClose}
                onPress={() => setIsCameraOpen(false)}
              >
                <Ionicons name="close" size={28} color="#FFFFFF" />
              </TouchableOpacity>

              <View style={styles.cameraBottom}>
                <TouchableOpacity
                  style={styles.cameraCapture}
                  onPress={takePhoto}
                >
                  <View style={styles.cameraCaptureInner} />
                </TouchableOpacity>
              </View>
            </View>
          </CameraView>
        </View>
      )}

      {/* Submitting Overlay */}
      {isSubmitting && (
        <View style={styles.submittingOverlay}>
          <View style={styles.submittingBox}>
            <ActivityIndicator size="large" color="#EF4444" />
            <Text style={styles.submittingText}>Sending emergency alert...</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },

  /* Header */
  headerSafe: {
    backgroundColor: "#7F1D1D",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  headerSub: {
    fontSize: 11,
    color: "rgba(255,255,255,0.65)",
    marginTop: 1,
  },

  /* Scroll */
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 20,
  },

  /* Submit Button */
  submitWrap: {
    marginBottom: 14,
  },
  submitBtn: {
    borderRadius: 14,
    overflow: "hidden",
    elevation: 6,
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  submitGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  submitText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  submitHint: {
    fontSize: 10,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 8,
  },

  /* Card */
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#F1F5F9",
    flex: 1,
  },
  cardOptional: {
    fontSize: 10,
    fontWeight: "600",
    color: "#6B7280",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },

  /* Location */
  locationBody: {
    gap: 8,
  },
  locationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  locationLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94A3B8",
    width: 70,
  },
  locationValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#E2E8F0",
    textAlign: "right",
  },
  locationLiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4ADE80",
  },
  locationLiveText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#4ADE80",
  },

  /* Evidence */
  evidenceAdd: {
    borderWidth: 1.5,
    borderColor: "rgba(239,68,68,0.3)",
    borderStyle: "dashed",
    borderRadius: 12,
    paddingVertical: 24,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(239,68,68,0.04)",
  },
  evidenceAddText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94A3B8",
  },
  mediaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  mediaThumbWrap: {
    width: 80,
    height: 80,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#0f172a",
  },
  mediaThumb: {
    width: 80,
    height: 80,
    resizeMode: "cover",
  },
  mediaRemove: {
    position: "absolute",
    top: -6,
    right: -6,
  },
  videoBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 4,
    padding: 2,
  },
  addMediaBtn: {
    width: 80,
    height: 80,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "rgba(239,68,68,0.3)",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(239,68,68,0.04)",
  },

  /* Text Input */
  textInput: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: "#E2E8F0",
    minHeight: 100,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  charCount: {
    fontSize: 10,
    color: "#6B7280",
    textAlign: "right",
    marginTop: 6,
  },

  /* Legal */
  legalCard: {
    backgroundColor: "rgba(251,191,36,0.06)",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.15)",
    marginBottom: 14,
  },
  legalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  legalTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FCD34D",
  },
  legalText: {
    fontSize: 12,
    color: "rgba(251,191,36,0.8)",
    lineHeight: 18,
  },

  /* Camera */
  cameraModal: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    backgroundColor: "#000",
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: "space-between",
    padding: 24,
  },
  cameraClose: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "flex-end",
    marginTop: Platform.OS === "ios" ? 50 : 20,
  },
  cameraBottom: {
    alignItems: "center",
    paddingBottom: 40,
  },
  cameraCapture: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  cameraCaptureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FFFFFF",
  },

  /* Submitting Overlay */
  submittingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  submittingBox: {
    backgroundColor: "#1e293b",
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    gap: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  submittingText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#E2E8F0",
  },

  /* Submitted */
  submittedContainer: {
    flex: 1,
  },
  submittedGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  submittedContent: {
    alignItems: "center",
    maxWidth: 320,
  },
  successIconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(74,222,128,0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  submittedTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 8,
  },
  submittedSub: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 12,
  },
  submittedId: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.4)",
    marginBottom: 20,
  },
  stayCalmCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "rgba(252,211,77,0.08)",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(252,211,77,0.15)",
    marginBottom: 24,
  },
  stayCalmText: {
    fontSize: 12,
    color: "rgba(252,211,77,0.85)",
    lineHeight: 18,
    flex: 1,
  },
  backHomeBtn: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 999,
  },
  backHomeBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
