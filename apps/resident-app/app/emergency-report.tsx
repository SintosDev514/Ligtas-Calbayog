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
} from "expo-camera";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
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
  const [capturedMedia, setCapturedMedia] = useState<{ uri: string; type: "image" | "video" }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedId, setSubmittedId] = useState("");
  const [nearestPost, setNearestPost] = useState<string | null>(null);

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<"back" | "front">("back");
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const photoCameraRef = useRef<CameraView>(null);

  useEffect(() => {
    return () => {};
  }, []);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (location?.latitude && location?.longitude) {
      findNearestPost(location.latitude, location.longitude);
    }
  }, [location?.latitude, location?.longitude]);

  const openCamera = async () => {
    if (!cameraPermission?.granted) {
      const response = await requestCameraPermission();
      if (!response.granted) {
        Alert.alert("Permission Required", "Camera permission denied.");
        return;
      }
    }
    setIsCameraOpen(true);
  };

  const takePhoto = async () => {
    if (!photoCameraRef.current) return;
    try {
      const photo = await photoCameraRef.current.takePictureAsync({ quality: 0.7 });
      if (photo?.uri) {
        setCapturedMedia((prev) => [...prev, { uri: photo.uri, type: "image" }]);
      }
    } catch {
      Alert.alert("Error", "Failed to capture image.");
    } finally {
      setIsCameraOpen(false);
    }
  };

  const recordVideo = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Camera permission is needed to record video.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["videos"],
      videoMaxDuration: 30,
      quality: 0.7,
      cameraType: cameraFacing === "front" ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
    });

    if (!result.canceled && result.assets?.[0]) {
      setCapturedMedia((prev) => [...prev, { uri: result.assets[0].uri, type: "video" }]);
    }
  };

  const removeMedia = (index: number) => {
    setCapturedMedia((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadReportMedia = async (uri: string, type: "image" | "video") => {
    const ext = type === "video" ? "mp4" : "jpg";
    const filename = `emergency-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
    const contentType = type === "video" ? "video/mp4" : "image/jpeg";

    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: "base64",
    });
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

    const { error } = await supabase.storage
      .from("report-photos")
      .upload(filename, bytes, { contentType, upsert: true });

    if (error) throw new Error(error.message);

    const { data } = supabase.storage
      .from("report-photos")
      .getPublicUrl(filename);

    return data.publicUrl;
  };

  const findNearestPost = async (lat: number, lng: number) => {
    const { data: posts } = await supabase
      .from("police_posts")
      .select("name, latitude, longitude");
    if (!posts || posts.length === 0) return;
    let nearest = posts[0];
    let minDist = Infinity;
    for (const p of posts) {
      const d = haversine(lat, lng, p.latitude, p.longitude);
      if (d < minDist) { minDist = d; nearest = p; }
    }
    setNearestPost(nearest.name);
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

            {nearestPost && (
              <View style={styles.nearestPostSubmitted}>
                <Ionicons name="location" size={16} color="#FCD34D" />
                <Text style={styles.nearestPostSubmittedText}>Nearest post: {nearestPost}</Text>
              </View>
            )}

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

            {nearestPost && (
              <View style={styles.nearestPostCard}>
                <Ionicons name="location" size={16} color="#F59E0B" />
                <Text style={styles.nearestPostText}>Nearest post: {nearestPost}</Text>
              </View>
            )}
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
                <Text style={styles.evidenceAddText}>Tap to capture photo or video evidence</Text>
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
            ref={photoCameraRef}
            style={StyleSheet.absoluteFill}
            facing={cameraFacing}
            mode="picture"
          />
          <View style={styles.cameraBottomControls}>
            <View style={styles.modeTabsRow}>
              <TouchableOpacity
                style={[styles.modeTab, styles.modeTabActive]}
              >
                <Text style={[styles.modeTabText, styles.modeTabTextActive]}>
                  PHOTO
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setIsCameraOpen(false);
                  recordVideo();
                }}
                style={styles.modeTab}
              >
                <Text style={styles.modeTabText}>
                  VIDEO
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.cameraControlsRow}>
              <TouchableOpacity
                style={styles.cameraClose}
                onPress={() => setIsCameraOpen(false)}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.captureButton}
                onPress={takePhoto}
              >
                <View style={styles.captureInner} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cameraClose}
                onPress={() => setCameraFacing((prev) => (prev === "back" ? "front" : "back"))}
              >
                <Ionicons name="camera-reverse" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
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

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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

  recordingHeader: {
    position: "absolute",
    top: 50,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(220, 38, 38, 0.85)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
  },

  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FFFFFF",
    marginRight: 8,
  },

  recordingTimerText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 12,
  },

  cameraBottomControls: {
    position: "absolute",
    bottom: 24,
    width: "100%",
    alignItems: "center",
  },

  modeTabsRow: {
    flexDirection: "row",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 30,
    padding: 4,
    marginBottom: 16,
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },

  modeTab: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },

  modeTabActive: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },

  modeTabText: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  modeTabTextActive: {
    color: "#FFFFFF",
  },

  cameraControlsRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 30,
  },

  cameraClose: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },

  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },

  captureInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
  },

  captureInnerVideoRecording: {
    width: 26,
    height: 26,
    borderRadius: 4,
    backgroundColor: "#EF4444",
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
  nearestPostSubmitted: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(252,211,77,0.1)",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(252,211,77,0.2)",
    marginBottom: 20,
    width: "100%",
  },
  nearestPostSubmittedText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FCD34D",
    marginLeft: 8,
    flex: 1,
  },
  nearestPostCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#FDE68A",
    marginTop: 12,
  },
  nearestPostText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#92400E",
    marginLeft: 8,
    flex: 1,
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
