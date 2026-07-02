import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Animated,
  StatusBar,
  Platform,
  KeyboardAvoidingView,
  Modal,
  Image,
} from "react-native";

import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { File } from "expo-file-system";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
} from "expo-camera";
import MapView, { Marker, UrlTile } from "@/components/MapView";

import { supabase } from "../../../../shared/supabase/supabaseClient";
import {
  submitCrimeReport,
  getActivePenalty,
} from "../../../../shared/services/reportService";
import { useLocation } from "../../context/LocationContext";
import { useMapStyle } from "../../context/MapStyleContext";

const CRIME_META: Record<
  string,
  {
    icon: string;
    color: string;
    gradient: string[];
  }
> = {
  "hit-and-run": {
    icon: "car-sport",
    color: "#EF4444",
    gradient: ["#EF4444", "#DC2626"],
  },

  robbery: {
    icon: "skull",
    color: "#F97316",
    gradient: ["#F97316", "#EA580C"],
  },

  theft: {
    icon: "bag-remove",
    color: "#EAB308",
    gradient: ["#EAB308", "#CA8A04"],
  },

  assault: {
    icon: "alert-circle",
    color: "#8B5CF6",
    gradient: ["#8B5CF6", "#7C3AED"],
  },

  vandalism: {
    icon: "hammer",
    color: "#14B8A6",
    gradient: ["#14B8A6", "#0D9488"],
  },

  burglary: {
    icon: "home-remove",
    color: "#3B82F6",
    gradient: ["#3B82F6", "#2563EB"],
  },

  others: {
    icon: "shield-half",
    color: "#64748B",
    gradient: ["#64748B", "#334155"],
  },
};

export default function ReportScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { location: sharedLocation, isLiveLocationActive } = useLocation();
  const { tileUrl, mapStyle } = useMapStyle();

  const crimeType = (params.crimeType as string) || "others";
  const crimeLabel = (params.crimeLabel as string) || "Emergency Report";

  const meta = CRIME_META[crimeType] ?? CRIME_META.others;

  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDescriptionFocused, setIsDescriptionFocused] = useState(false);

  // Use shared location from context
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    address: string;
  } | null>(null);

  // Multi-Media state
  const [capturedMedia, setCapturedMedia] = useState<
    { uri: string; type: "image" | "video" }[]
  >([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraMode, setCameraMode] = useState<"picture" | "video">("picture");
  const [isRecording, setIsRecording] = useState(false);
  const [recordTimer, setRecordTimer] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [submittedReportId, setSubmittedReportId] = useState<string>("");

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const successAnim = useRef(new Animated.Value(0)).current;

  const cameraRef = useRef<any>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),

      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      }),
    ]).start();

    // Use location from context
    if (sharedLocation) {
      setLocation(sharedLocation);
    }
  }, [sharedLocation, fadeAnim, slideAnim]);

  useEffect(() => {
    if (!isLiveLocationActive) {
      pulseAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isLiveLocationActive, pulseAnim]);

  useEffect(() => {
    if (showSuccess) {
      Animated.spring(successAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }).start();
    } else {
      successAnim.setValue(0);
    }
  }, [showSuccess, successAnim]);

  // Function to refresh location from the dashboard's shared location
  const refreshLocation = () => {
    if (sharedLocation) {
      setLocation(sharedLocation);
      Alert.alert("Location Updated", "Using current location from dashboard.");
    } else {
      Alert.alert(
        "No Location",
        "Please enable location sharing in the dashboard first.",
      );
    }
  };

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

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
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
      });

      if (photo?.uri) {
        setCapturedMedia((prev) => [
          ...prev,
          { uri: photo.uri, type: "image" },
        ]);
      }
    } catch {
      Alert.alert("Error", "Failed to capture image.");
    } finally {
      setIsCameraOpen(false);
    }
  };

  const toggleRecording = async () => {
    if (!cameraRef.current) return;

    if (isRecording) {
      // Stop recording
      cameraRef.current.stopRecording();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    } else {
      // Start recording
      try {
        setIsRecording(true);
        setRecordTimer(0);

        timerRef.current = setInterval(() => {
          setRecordTimer((prev) => {
            if (prev >= 14) {
              // Auto stop recording at 15s limit
              if (cameraRef.current) {
                cameraRef.current.stopRecording();
              }
              if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
              }
              return 15;
            }
            return prev + 1;
          });
        }, 1000);

        const video = await cameraRef.current.recordAsync({
          maxDuration: 15,
          quality: "720p",
        });

        if (video?.uri) {
          setCapturedMedia((prev) => [
            ...prev,
            { uri: video.uri, type: "video" },
          ]);
        }
      } catch {
        Alert.alert("Recording Error", "Unable to start video recording.");
        setIsRecording(false);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      } finally {
        setIsCameraOpen(false);
      }
    }
  };

  const removeMedia = (index: number) => {
    setCapturedMedia((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadReportMedia = async (uri: string, type: "image" | "video") => {
    const ext = type === "video" ? "mp4" : "jpg";
    const filename = `report-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
    const contentType = type === "video" ? "video/mp4" : "image/jpeg";

    const buffer = (await new File(uri).bytes()).buffer;

    const { error } = await supabase.storage
      .from("report-photos")
      .upload(filename, buffer, { contentType, upsert: true });

    if (error) throw new Error(error.message);

    const { data } = supabase.storage
      .from("report-photos")
      .getPublicUrl(filename);

    return data.publicUrl;
  };

  const handleSubmit = async () => {
    if (!description.trim() && capturedMedia.length === 0) {
      Alert.alert(
        "Incomplete Report",
        "Please add a description or attach evidence before submitting.",
      );
      return;
    }

    try {
      setIsSubmitting(true);

      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;

      if (!userId) {
        Alert.alert("Error", "Please login first.");
        return;
      }

      // Check for active penalty
      const penalty = await getActivePenalty(userId);
      if (penalty) {
        if (penalty.type === "restriction") {
          Alert.alert(
            "Account Restricted",
            "Your account is currently restricted due to excessive report cancellations. You cannot submit new reports at this time.",
          );
          setIsSubmitting(false);
          return;
        }
        if (penalty.type === "ban") {
          Alert.alert(
            "Account Banned",
            "Your account has been banned from submitting reports due to excessive cancellations. You may file an appeal from the My Reports screen.",
          );
          setIsSubmitting(false);
          return;
        }
      }

      let photoUrl: string | undefined = undefined;

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
        crimeType,
        description,
        latitude: location?.latitude,
        longitude: location?.longitude,
        locationAddress: location?.address,
        photoUrl: photoUrl as any,
      });

      // Show success modal with report ID for transparency
      setSubmittedReportId(result?.id?.toString() ?? "");
      setShowSuccess(true);
    } catch (err: any) {
      Alert.alert(
        "Submission Failed",
        err.message || "An unexpected error occurred. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTimer = (secs: number) => {
    const s = secs % 60;
    return `00:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <SafeAreaView edges={["top"]} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>

          <View style={styles.titleContainer}>
            <View style={styles.headerIconCircle}>
              <Ionicons name={meta.icon as any} size={16} color="#fff" />
            </View>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {crimeLabel}
            </Text>
          </View>

          <View style={styles.secureBadgeCompact}>
            <Ionicons name="shield-checkmark" size={14} color="#F4B51A" />
            <Text style={styles.secureTextCompact}>SECURE</Text>
          </View>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: 40,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }}
          >
            {/* GPS LOCATION CARD */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIcon, { backgroundColor: "#F0F4F8" }]}>
                  <Ionicons name="location" size={20} color="#1565C0" />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Live GPS Location</Text>
                  <Text style={styles.cardSubtitle}>
                    {isLiveLocationActive
                      ? "Real-time tracking active"
                      : "Required for dispatching assistance"}
                  </Text>
                </View>
              </View>

              {location ? (
                <>
                  <View style={styles.locationBox}>
                    <Ionicons
                      name={
                        isLiveLocationActive
                          ? "navigate-circle"
                          : "checkmark-circle"
                      }
                      size={20}
                      color={isLiveLocationActive ? "#1565C0" : "#10B981"}
                    />

                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.locationAddress}>
                        {location.address}
                      </Text>

                      <Text style={styles.locationCoords}>
                        Coordinates: {location.latitude.toFixed(5)},{" "}
                        {location.longitude.toFixed(5)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.mapContainer}>
                    <MapView
                      style={styles.map}
                      mapType="none"
                      mapStyle={mapStyle}
                      showsUserLocation
                      showsCompass
                      loadingEnabled
                      initialRegion={{
                        latitude: location.latitude,
                        longitude: location.longitude,
                        latitudeDelta: 0.005,
                        longitudeDelta: 0.005,
                      }}
                    >
                      <UrlTile urlTemplate={tileUrl} />
                      <Marker
                        coordinate={{
                          latitude: location.latitude,
                          longitude: location.longitude,
                        }}
                      >
                        <View style={styles.markerWrap}>
                          <Animated.View
                            style={[
                              StyleSheet.absoluteFill,
                              {
                                borderRadius: 19,
                                borderWidth: 3,
                                borderColor: "#22C55E",
                                backgroundColor: "rgba(34, 197, 94, 0.2)",
                                opacity: isLiveLocationActive
                                  ? pulseAnim.interpolate({
                                      inputRange: [0, 1],
                                      outputRange: [0.8, 0],
                                    })
                                  : 0,
                                transform: [
                                  {
                                    scale: isLiveLocationActive
                                      ? pulseAnim.interpolate({
                                          inputRange: [0, 1],
                                          outputRange: [1.35, 1],
                                        })
                                      : 1,
                                  },
                                ],
                              },
                            ]}
                            pointerEvents="none"
                          />
                          <Ionicons name="shield" size={18} color="#fff" />
                        </View>
                      </Marker>
                    </MapView>

                    <View style={styles.mapOverlay} />

                    <View style={styles.mapFloatingInfo}>
                      <Ionicons name="navigate" size={14} color="#F4B51A" />
                      <Text style={styles.mapFloatingText} numberOfLines={1}>
                        {isLiveLocationActive
                          ? "Live Feed Active"
                          : "High-Fidelity Satellite Feed Active"}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.retryLocationBtn}
                    onPress={refreshLocation}
                  >
                    <Ionicons name="refresh" size={18} color="#1565C0" />
                    <Text style={styles.retryLocationText}>
                      Refresh Location
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={[styles.retryLocationBtn, { borderColor: "#EF4444" }]}
                  onPress={refreshLocation}
                >
                  <Ionicons name="warning" size={18} color="#EF4444" />
                  <Text
                    style={[styles.retryLocationText, { color: "#EF4444" }]}
                  >
                    Enable Location in Dashboard
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* MULTI-MEDIA EVIDENCE CARD */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIcon, { backgroundColor: "#F0F4F8" }]}>
                  <Ionicons name="images" size={20} color="#1565C0" />
                </View>

                <View>
                  <Text style={styles.cardTitle}>Evidence Attachments</Text>
                  <Text style={styles.cardSubtitle}>
                    Photos or video clips of the scene (Max 15s clips)
                  </Text>
                </View>
              </View>

              {/* Horizontal List of captured media */}
              {capturedMedia.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.mediaScroll}
                >
                  {capturedMedia.map((item, index) => (
                    <View key={index} style={styles.thumbnailContainer}>
                      <Image
                        source={{ uri: item.uri }}
                        style={styles.mediaThumbnail}
                      />

                      {item.type === "video" && (
                        <View style={styles.playIconOverlay}>
                          <Ionicons name="play-circle" size={32} color="#fff" />
                          <Text style={styles.videoBadgeText}>VIDEO</Text>
                        </View>
                      )}

                      <TouchableOpacity
                        style={styles.deleteMediaBtn}
                        onPress={() => removeMedia(index)}
                      >
                        <Ionicons
                          name="close-circle"
                          size={20}
                          color="#EF4444"
                        />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}

              <TouchableOpacity
                style={styles.cameraButton}
                onPress={openCamera}
              >
                <View style={styles.cameraIconBg}>
                  <Ionicons name="camera" size={24} color="#1565C0" />
                </View>

                <Text style={styles.cameraButtonText}>
                  Capture Photo or Video
                </Text>
                <Text style={styles.cameraButtonSubText}>
                  Add multiple files to your report
                </Text>
              </TouchableOpacity>
            </View>

            {/* INCIDENT DETAILS */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIcon, { backgroundColor: "#F0F4F8" }]}>
                  <Ionicons name="document-text" size={20} color="#1565C0" />
                </View>

                <View>
                  <Text style={styles.cardTitle}>Incident Details</Text>
                  <Text style={styles.cardSubtitle}>
                    Provide any helpful information about the scene
                  </Text>
                </View>
              </View>

              <TextInput
                style={[
                  styles.descriptionInput,
                  isDescriptionFocused && {
                    borderColor: meta.color,
                    shadowColor: meta.color,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.1,
                    shadowRadius: 8,
                    elevation: 4,
                  },
                ]}
                placeholder="Type details (e.g. suspect appearance, vehicle color/plate, severity of incident)..."
                placeholderTextColor="#94A3B8"
                multiline
                value={description}
                onChangeText={setDescription}
                textAlignVertical="top"
                onFocus={() => setIsDescriptionFocused(true)}
                onBlur={() => setIsDescriptionFocused(false)}
              />

              <View style={styles.countRow}>
                <Text style={styles.characterCount}>
                  {description.length} characters
                </Text>
              </View>
            </View>

            {/* WARNING CARD */}
            <View style={styles.warningCard}>
              <View style={styles.warningHeader}>
                <Ionicons name="warning" size={20} color="#1565C0" />
                <Text style={styles.warningTitle}>Legal Advisory</Text>
              </View>
              <Text style={styles.warningText}>
                Under Presidential Decree No. 1727, filing a false emergency
                report is strictly illegal and subject to imprisonment and heavy
                fines.
              </Text>
            </View>

            {/* SUBMIT BUTTON */}
            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && { opacity: 0.8 }]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons
                    name="shield-half"
                    size={20}
                    color="#fff"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.submitText}>
                    Submit Official Report
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* SUCCESS CONFIRMATION MODAL */}
      <Modal visible={showSuccess} transparent animationType="fade">
        <View style={styles.successOverlay}>
          <Animated.View
            style={[
              styles.successModal,
              {
                opacity: successAnim,
                transform: [{ scale: successAnim }],
              },
            ]}
          >
            {/* Success Icon */}
            <View
              style={[
                styles.successIconCircle,
                { backgroundColor: meta.color + "15" },
              ]}
            >
              <Ionicons
                name="checkmark-circle"
                size={40}
                color={meta.color}
              />
            </View>

            <Text style={styles.successTitle}>Report Filed</Text>

            <Text style={styles.successSubtitle}>
              Incident reported to Calbayog Police.
            </Text>

            {submittedReportId && (
              <View style={styles.referenceBox}>
                <View style={styles.refBoxHeader}>
                  <Ionicons name="finger-print" size={14} color="#64748B" />
                  <Text style={styles.refLabel}>Reference ID</Text>
                </View>
                <Text style={styles.refValue}>
                  {submittedReportId.toUpperCase().slice(0, 8)}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.successPrimaryBtn]}
              onPress={() => {
                setShowSuccess(false);
                router.replace("/(tabs)/my-reports" as any);
              }}
            >
              <Ionicons
                name="list-outline"
                size={18}
                color="#fff"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.successPrimaryBtnText}>
                View My Reports
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.successSecondaryBtn}
              onPress={() => {
                setShowSuccess(false);
                setDescription("");
                setCapturedMedia([]);
              }}
            >
              <Ionicons
                name="add-circle-outline"
                size={18}
                color="#17202b"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.successSecondaryBtnText}>
                File Another Report
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      <Modal visible={isCameraOpen} animationType="slide">
        <View style={styles.cameraModal}>
          {/* Recording Status Header */}
          {isRecording && (
            <View style={styles.recordingHeader}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingTimerText}>
                REC {formatTimer(recordTimer)} (15s Max)
              </Text>
            </View>
          )}

          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing="back"
            mode={cameraMode}
          />

          <View style={styles.cameraBottomControls}>
            {/* PHOTO / VIDEO Mode Tabs */}
            {!isRecording && (
              <View style={styles.modeTabsRow}>
                <TouchableOpacity
                  onPress={() => setCameraMode("picture")}
                  style={[
                    styles.modeTab,
                    cameraMode === "picture" && styles.modeTabActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.modeTabText,
                      cameraMode === "picture" && styles.modeTabTextActive,
                    ]}
                  >
                    PHOTO
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setCameraMode("video")}
                  style={[
                    styles.modeTab,
                    cameraMode === "video" && styles.modeTabActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.modeTabText,
                      cameraMode === "video" && styles.modeTabTextActive,
                    ]}
                  >
                    VIDEO
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.cameraControlsRow}>
              <TouchableOpacity
                style={styles.cameraClose}
                onPress={() => setIsCameraOpen(false)}
                disabled={isRecording}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>

              {cameraMode === "picture" ? (
                <TouchableOpacity
                  style={styles.captureButton}
                  onPress={takePhoto}
                >
                  <View style={styles.captureInner} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.captureButton, { borderColor: "#EF4444" }]}
                  onPress={toggleRecording}
                >
                  <View
                    style={[
                      styles.captureInner,
                      isRecording
                        ? styles.captureInnerVideoRecording
                        : { backgroundColor: "#EF4444" },
                    ]}
                  />
                </TouchableOpacity>
              )}

              <View style={{ width: 50 }} />
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
    backgroundColor: "#F5F7FA",
  },

  header: {
    backgroundColor: "#17202b",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },

  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },

  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    marginHorizontal: 10,
  },

  headerIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },

  headerTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  secureBadgeCompact: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },

  secureTextCompact: {
    color: "#FFFFFF",
    marginLeft: 4,
    fontWeight: "800",
    fontSize: 9,
    letterSpacing: 0.5,
  },

  scroll: {
    flex: 1,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#E8EEF5",
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },

  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#17202b",
  },

  cardSubtitle: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
    fontWeight: "500",
  },

  locatingBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },

  locatingText: {
    fontSize: 13,
    color: "#64748B",
    marginLeft: 8,
    fontWeight: "600",
  },

  retryLocationBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E8EEF5",
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 8,
    backgroundColor: "#F5F7FA",
  },

  retryLocationText: {
    color: "#1565C0",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },

  locationBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F4F8",
    padding: 14,
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E8EEF5",
  },

  locationAddress: {
    fontSize: 13,
    fontWeight: "700",
    color: "#17202b",
    lineHeight: 18,
  },

  locationCoords: {
    fontSize: 11,
    color: "#1565C0",
    marginTop: 2,
    fontWeight: "600",
  },

  mapContainer: {
    height: 220,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E8EEF5",
  },

  map: {
    width: "100%",
    height: "100%",
  },

  markerWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#17202b",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#22C55E",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },

  mapOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 60,
    backgroundColor: "rgba(0,0,0,0.4)",
  },

  mapFloatingInfo: {
    position: "absolute",
    left: 10,
    bottom: 10,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(23, 32, 43, 0.85)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },

  mapFloatingText: {
    color: "#FFFFFF",
    marginLeft: 6,
    fontSize: 11,
    fontWeight: "700",
  },

  mediaScroll: {
    paddingBottom: 14,
    gap: 12,
  },

  thumbnailContainer: {
    position: "relative",
    width: 110,
    height: 110,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "#E8EEF5",
  },

  mediaThumbnail: {
    width: "100%",
    height: "100%",
  },

  playIconOverlay: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },

  videoBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
    marginTop: 2,
    letterSpacing: 0.5,
  },

  deleteMediaBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 0,
  },

  cameraButton: {
    borderWidth: 2,
    borderColor: "#E8EEF5",
    borderStyle: "dashed",
    borderRadius: 14,
    paddingVertical: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F7FA",
    marginTop: 6,
  },

  cameraIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F0F4F8",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },

  cameraButtonText: {
    fontWeight: "700",
    color: "#17202b",
    fontSize: 14,
  },

  cameraButtonSubText: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 3,
    fontWeight: "500",
  },

  descriptionInput: {
    minHeight: 120,
    backgroundColor: "#F5F7FA",
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    color: "#17202b",
    borderWidth: 1.5,
    borderColor: "#E8EEF5",
    lineHeight: 22,
  },

  countRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 6,
  },

  characterCount: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "600",
  },

  warningCard: {
    backgroundColor: "#F0F4F8",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E8EEF5",
  },

  warningHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },

  warningTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#17202b",
    marginLeft: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  warningText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
    lineHeight: 18,
  },

  submitButton: {
    backgroundColor: "#17202b",
    paddingVertical: 16,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    height: 54,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 8,
  },

  submitText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
    letterSpacing: 0.5,
  },

  cameraModal: {
    flex: 1,
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

  camera: {
    flex: 1,
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

  successOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },

  successModal: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },

  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },

  successTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#17202b",
    textAlign: "center",
    marginBottom: 6,
  },

  successSubtitle: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 18,
    fontWeight: "500",
  },

  referenceBox: {
    width: "100%",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 18,
  },

  refBoxHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },

  refLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginLeft: 6,
  },

  refValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#17202b",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    letterSpacing: 1,
  },

  successPrimaryBtn: {
    width: "100%",
    backgroundColor: "#17202b",
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    shadowColor: "#17202b",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },

  successPrimaryBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },

  successSecondaryBtn: {
    width: "100%",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  successSecondaryBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#17202b",
  },
});
