import React, { useState, useEffect } from "react";
import {
  View,
  Alert,
  StyleSheet,
  Modal,
  FlatList,
  TouchableOpacity,
  Text,
  StatusBar,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import MapView, { Marker, UrlTile } from "@/components/MapView";
import { InputField } from "../../components/ui/InputField";
import { Button } from "../../components/ui/Button";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMapStyle } from "../../context/MapStyleContext";
import { supabase } from "../../../../shared/supabase/supabaseClient";

const TOTAL_STEPS = 5;

const CALBAYOG_BARANGAYS = [
  "Acedillo", "Aguit-itan", "Aliwanay", "Amampacang", "Anislag",
  "Awang East", "Awang West", "Bagacay", "Bagong Lipunan", "Baluarte",
  "Balud", "Bantian", "Basud", "Binaliw", "Bugtong", "Cag-anahaw",
  "Cagbanayacao", "Cagmanaba", "Cagnipa", "Cag-olango", "Calocnayan",
  "Canhumadac", "Capoocan", "Carmen", "Central", "Dagum", "Dinabongan",
  "Esperanza", "Germinal", "Gadgran", "Hamorawon", "Hibabngan", "Jacinto",
  "Kalilihan", "Kinalabasa", "Kinalansan", "Looc", "Mabini I", "Mabini II",
  "Mahayag", "Malajog", "Malopalo", "Matobato", "Migara", "Nijaga",
  "Olera", "Obrero", "Osmeña", "Palanas", "Panlayahan", "Payahan",
  "Rawis", "Rizal I", "Rizal II", "Saljag", "San Antonio", "San Isidro",
  "San Jose", "San Policarpo", "San Roque", "San Rufino", "Sinalangtan",
  "Tinambacan District", "Trinidad", "Victory",
].sort();

export default function Register() {
  const router = useRouter();
  const { tileUrl, mapStyle } = useMapStyle();

  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [street, setStreet] = useState("");
  const [barangay, setBarangay] = useState("");
  const [showBarangayPicker, setShowBarangayPicker] = useState(false);
  const [emergencyContact, setEmergencyContact] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [fatherName, setFatherName] = useState("");
  const [fatherPhone, setFatherPhone] = useState("");
  const [motherName, setMotherName] = useState("");
  const [motherPhone, setMotherPhone] = useState("");

  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "loading" | "got" | "denied">("idle");

  const [pinnedLocation, setPinnedLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [pinnedAddress, setPinnedAddress] = useState<string>("");
  const [isPinValid, setIsPinValid] = useState<boolean | null>(null);
  const [isPinning, setIsPinning] = useState(false);

  const [idPhotoUri, setIdPhotoUri] = useState<string | null>(null);
  const [idPhotoUploaded, setIdPhotoUploaded] = useState(false);

  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);

  useEffect(() => {
    if (step === 2 && locationStatus === "idle") {
      getLocation();
    }
  }, [step]);

  const getLocation = async () => {
    setLocationStatus("loading");
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setLocationStatus("denied");
      return;
    }
    const loc = await Location.getCurrentPositionAsync({});
    setLocation({
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    });
    setLocationStatus("got");
  };

  const CALBAYOG_BOUNDS = {
    minLat: 11.95,
    maxLat: 12.25,
    minLng: 124.45,
    maxLng: 124.85,
  };

  const isWithinCalbayog = (lat: number, lng: number) => {
    return (
      lat >= CALBAYOG_BOUNDS.minLat &&
      lat <= CALBAYOG_BOUNDS.maxLat &&
      lng >= CALBAYOG_BOUNDS.minLng &&
      lng <= CALBAYOG_BOUNDS.maxLng
    );
  };

  const reverseGeocodePinned = async (lat: number, lng: number) => {
    try {
      const geo = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (geo.length > 0) {
        const g = geo[0];
        const addr = [g.street, g.district, g.city, g.region].filter(Boolean).join(", ");
        setPinnedAddress(addr);
        const valid = isWithinCalbayog(lat, lng);
        setIsPinValid(valid);
        return { address: addr, valid };
      }
    } catch {}
    setPinnedAddress("Unable to resolve address");
    setIsPinValid(false);
    return { address: "Unable to resolve address", valid: false };
  };

  const handleMapPress = async (e: any) => {
    const coord = e?.nativeEvent?.coordinate || e?.coordinate;
    if (!coord) return;
    setPinnedLocation({ latitude: coord.latitude, longitude: coord.longitude });
    await reverseGeocodePinned(coord.latitude, coord.longitude);
  };

  const handleMarkerDragEnd = async (e: any) => {
    const coord = e?.nativeEvent?.coordinate;
    if (!coord) return;
    setPinnedLocation({ latitude: coord.latitude, longitude: coord.longitude });
    await reverseGeocodePinned(coord.latitude, coord.longitude);
  };

  const usePinnedLocation = () => {
    if (pinnedLocation && isPinValid) {
      setLocation(pinnedLocation);
      setIsPinning(false);
      Alert.alert("Location Updated", "Your pinned location has been set.");
    }
  };

  const startPinning = () => {
    setIsPinning(true);
    setPinnedLocation(location ? { ...location } : null);
    setPinnedAddress("");
    setIsPinValid(null);
  };

  const pickIdPhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Camera access is required to upload your ID.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setIdPhotoUri(result.assets[0].uri);
      setIdPhotoUploaded(true);
    }
  };

  const sendOtp = async () => {
    if (!email) {
      Alert.alert("Error", "Email is required");
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) throw error;
      setOtpSent(true);
      Alert.alert("OTP Sent", `A verification code has been sent to ${email}`);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to send OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: "email",
      });
      if (error) throw error;
      setOtpVerified(true);
      Alert.alert("Verified", "Email verified successfully!");
    } catch (err: any) {
      Alert.alert("Invalid Code", "The code you entered is incorrect. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = () => {
    if (step === 1 && (!email || !password)) {
      Alert.alert("Error", "Please enter email and password");
      return;
    }
    if (step === 2 && (!fullName || !phoneNumber || !street || !barangay)) {
      Alert.alert("Error", "Please fill in all personal details including your barangay");
      return;
    }
    if (step === 3 && (!guardianName || !guardianPhone)) {
      Alert.alert("Error", "Guardian name and phone number are required");
      return;
    }
    if (step === 4 && !location) {
      Alert.alert("Error", "Please allow location access and confirm your address");
      return;
    }
    if (step === 5 && !otpVerified) {
      Alert.alert("Error", "Please verify your email with the OTP code");
      return;
    }
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      router.back();
    }
  };

  const handleRegister = async () => {
    setIsLoading(true);
    try {
      const formattedAddress = `${street}, Brgy. ${barangay}, Calbayog City, Samar`;

      const { error: pwdError } = await supabase.auth.updateUser({ password });
      if (pwdError) throw pwdError;

      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) throw new Error("Failed to get user session");

      let idPhotoURL: string | null = null;
      if (idPhotoUri) {
        try {
          const response = await fetch(idPhotoUri);
          const blob = await response.blob();
          const filePath = `ids/${uid}.jpg`;
          const { error: uploadError } = await supabase.storage
            .from("profile-photos")
            .upload(filePath, blob, { contentType: "image/jpeg", upsert: true });
          if (!uploadError) {
            const { data: urlData } = supabase.storage.from("profile-photos").getPublicUrl(filePath);
            idPhotoURL = urlData?.publicUrl ?? null;
          }
        } catch (err) {
          console.warn("ID photo upload failed:", err);
        }
      }

      const { error: userError } = await supabase.from("users").insert({
        id: uid,
        email,
        role: "resident",
        status: "approved",
        created_at: new Date().toISOString(),
      });
      if (userError) throw userError;

      const { error: profileError } = await supabase.from("resident_profiles").insert({
        id: uid,
        full_name: fullName,
        address: formattedAddress,
        phone_number: phoneNumber,
        emergency_contact: emergencyContact,
        guardian_name: guardianName || null,
        guardian_phone: guardianPhone || null,
        father_name: fatherName || null,
        father_phone: fatherPhone || null,
        mother_name: motherName || null,
        mother_phone: motherPhone || null,
        latitude: location?.latitude ?? null,
        longitude: location?.longitude ?? null,
        id_photo_url: idPhotoURL,
        avatar_url: idPhotoURL,
      });
      if (profileError) throw profileError;

      await supabase.auth.signOut();

      Alert.alert("Success", "Registration complete! Welcome to Ligtas Calbayog.");
      router.replace("/(tabs)/login" as any);
    } catch (err: any) {
      Alert.alert("Registration Failed", err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const stepTitles = [
    "Account Information",
    "Personal Details",
    "Guardian & ID",
    "Location Verification",
    "Email Verification",
  ];
  const stepSubtitles = [
    "Create your login credentials",
    "Tell us about yourself",
    "Guardian info, family details, and ID upload",
    "Confirm your location via satellite",
    "Enter the OTP sent to your email",
  ];

  const inputCommon = {
    placeholderTextColor: "#94A3B8" as string,
    labelStyle: { color: "#64748B" } as object,
  };
  const inputStyle = {
    backgroundColor: "transparent",
    borderWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
    borderRadius: 0,
    color: "#11181C",
    paddingHorizontal: 0,
    paddingVertical: 12,
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F7FA" }}>
      <StatusBar barStyle="light-content" backgroundColor="#0F204B" />
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F5F7FA" }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Navy header with logo */}
            <View style={{
              backgroundColor: "#0F204B",
              justifyContent: "center",
              alignItems: "center",
              paddingTop: 24,
              paddingBottom: 24,
              borderBottomLeftRadius: 40,
              borderBottomRightRadius: 40,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
              elevation: 8,
              zIndex: 1,
            }}>
              <Image
                source={require("../../assets/images/logo-white.png")}
                style={{ width: 56, height: 56 }}
                resizeMode="contain"
              />
              <Text style={{ fontSize: 16, fontWeight: "800", color: "#FFFFFF", marginTop: 4, letterSpacing: 0.5 }}>
                Ligtas Calbayog
              </Text>
              <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 1, letterSpacing: 0.3 }}>
                Your Safety, Our Priority
              </Text>
            </View>

            {/* Floating white card */}
            <View style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 24,
              padding: 28,
              marginTop: 20,
              marginHorizontal: 16,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.12,
              shadowRadius: 14,
              elevation: 8,
              borderWidth: 1,
              borderColor: "#E8EEF5",
            }}>
              {/* Step indicator */}
              <View style={styles.stepRow}>
                {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && (
                      <View style={[
                        styles.stepLine,
                        i < step && styles.stepLineActive,
                      ]} />
                    )}
                    <View style={[
                      styles.stepCircle,
                      i + 1 < step && styles.stepCircleDone,
                      i + 1 === step && styles.stepCircleCurrent,
                    ]}>
                      <Text style={[
                        styles.stepNumber,
                        (i + 1 < step || i + 1 === step) && styles.stepNumberActive,
                      ]}>
                        {i + 1}
                      </Text>
                    </View>
                  </React.Fragment>
                ))}
              </View>

              <View style={{ marginBottom: 24 }}>
                <Text style={{ fontSize: 18, fontWeight: "700", color: "#17202b" }}>
                  {stepTitles[step - 1]}
                </Text>
                <Text style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>
                  {stepSubtitles[step - 1]}
                </Text>
              </View>

              <View style={{ marginBottom: 24 }}>
                {step === 1 && (
                  <>
                    <InputField
                      label="Email Address"
                      placeholder="Enter your email"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={email}
                      onChangeText={setEmail}
                      {...inputCommon}
                      style={inputStyle}
                    />
                    <View style={{ marginBottom: 16 }}>
                      <Text style={{ fontSize: 14, color: "#64748B", marginBottom: 6, fontWeight: "600" }}>
                        Password
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <TextInput
                          placeholder="Create a password (min 6 characters)"
                          placeholderTextColor="#94A3B8"
                          secureTextEntry={!showPassword}
                          value={password}
                          onChangeText={setPassword}
                          style={{
                            flex: 1,
                            backgroundColor: "transparent",
                            borderWidth: 0,
                            borderBottomWidth: 1,
                            borderBottomColor: "#E5E5EA",
                            borderRadius: 0,
                            color: "#11181C",
                            paddingHorizontal: 0,
                            paddingVertical: 12,
                            fontSize: 16,
                          }}
                        />
                        <TouchableOpacity
                          onPress={() => setShowPassword(!showPassword)}
                          style={{ paddingLeft: 10, paddingVertical: 12 }}
                        >
                          <Ionicons
                            name={showPassword ? "eye-off" : "eye"}
                            size={20}
                            color="#94A3B8"
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </>
                )}

                {step === 2 && (
                  <>
                    <InputField
                      label="Full Name"
                      placeholder="Juan Dela Cruz"
                      value={fullName}
                      onChangeText={setFullName}
                      {...inputCommon}
                      style={inputStyle}
                    />
                    <InputField
                      label="Phone Number"
                      placeholder="09123456789"
                      keyboardType="phone-pad"
                      value={phoneNumber}
                      onChangeText={setPhoneNumber}
                      {...inputCommon}
                      style={inputStyle}
                    />
                    <InputField
                      label="Emergency Contact"
                      placeholder="Emergency contact phone number"
                      keyboardType="phone-pad"
                      value={emergencyContact}
                      onChangeText={setEmergencyContact}
                      {...inputCommon}
                      style={inputStyle}
                    />
                    <InputField
                      label="Street / House No."
                      placeholder="123 Mabini St."
                      value={street}
                      onChangeText={setStreet}
                      {...inputCommon}
                      style={inputStyle}
                    />

                    <Text style={styles.inputLabel}>Barangay</Text>
                    <TouchableOpacity
                      style={styles.pickerButton}
                      onPress={() => setShowBarangayPicker(true)}
                    >
                      <Text style={[styles.pickerText, !barangay && { color: "#94A3B8" }]}>
                        {barangay ? `Brgy. ${barangay}` : "Select your barangay"}
                      </Text>
                      <Ionicons name="chevron-down" size={20} color="#94A3B8" />
                    </TouchableOpacity>

                    <InputField
                      label="City / Province"
                      value="Calbayog City, Samar"
                      editable={false}
                      {...inputCommon}
                      style={{ ...inputStyle, opacity: 0.5 }}
                    />

                    <View style={{ marginTop: 12 }}>
                      <Text style={styles.inputLabel}>Current Location</Text>
                      {locationStatus === "loading" && (
                        <View style={styles.locationBox}>
                          <Ionicons name="locate" size={20} color="#94A3B8" />
                          <Text style={{ marginLeft: 8, color: "#94A3B8" }}>Getting your location...</Text>
                        </View>
                      )}
                      {locationStatus === "got" && location && (
                        <View style={[styles.locationBox, { backgroundColor: "#F0FDF4", borderColor: "#22C55E" }]}>
                          <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
                          <Text style={{ marginLeft: 8, color: "#16A34A" }}>
                            Location captured ({location.latitude.toFixed(4)}, {location.longitude.toFixed(4)})
                          </Text>
                        </View>
                      )}
                      {locationStatus === "denied" && (
                        <View style={[styles.locationBox, { backgroundColor: "#FEF2F2", borderColor: "#DC2626" }]}>
                          <Ionicons name="alert-circle" size={20} color="#DC2626" />
                          <Text style={{ marginLeft: 8, color: "#DC2626", flex: 1 }}>
                            Location permission denied. Enable it in settings.
                          </Text>
                        </View>
                      )}
                      {locationStatus === "idle" && (
                        <TouchableOpacity style={styles.locationBox} onPress={getLocation}>
                          <Ionicons name="locate-outline" size={20} color="#94A3B8" />
                          <Text style={{ marginLeft: 8, color: "#94A3B8" }}>Tap to get current location</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    <Modal visible={showBarangayPicker} animationType="slide" transparent>
                      <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                          <View style={styles.modalHeader}>
                            <Text style={{ fontSize: 17, fontWeight: "700", color: "#17202b" }}>
                              Select Barangay
                            </Text>
                            <TouchableOpacity onPress={() => setShowBarangayPicker(false)}>
                              <Ionicons name="close" size={24} color="#94A3B8" />
                            </TouchableOpacity>
                          </View>
                          <FlatList
                            data={CALBAYOG_BARANGAYS}
                            keyExtractor={(item) => item}
                            renderItem={({ item }) => (
                              <TouchableOpacity
                                style={styles.barangayItem}
                                onPress={() => {
                                  setBarangay(item);
                                  setShowBarangayPicker(false);
                                }}
                              >
                                <Text style={styles.barangayText}>{item}</Text>
                                {barangay === item && (
                                  <Ionicons name="checkmark-circle" size={22} color="#0F204B" />
                                )}
                              </TouchableOpacity>
                            )}
                          />
                        </View>
                      </View>
                    </Modal>
                  </>
                )}

                {step === 3 && (
                  <>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionLabel}>GUARDIAN (REQUIRED)</Text>
                    </View>
                    <InputField
                      label="Guardian's Full Name"
                      placeholder="Juan Dela Cruz"
                      value={guardianName}
                      onChangeText={setGuardianName}
                      {...inputCommon}
                      style={inputStyle}
                    />
                    <InputField
                      label="Guardian's Phone Number"
                      placeholder="09123456789"
                      keyboardType="phone-pad"
                      value={guardianPhone}
                      onChangeText={setGuardianPhone}
                      {...inputCommon}
                      style={inputStyle}
                    />

                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionLabel}>FATHER (OPTIONAL)</Text>
                    </View>
                    <InputField
                      label="Father's Name"
                      placeholder="Pedro Dela Cruz"
                      value={fatherName}
                      onChangeText={setFatherName}
                      {...inputCommon}
                      style={inputStyle}
                    />
                    <InputField
                      label="Father's Phone Number"
                      placeholder="09123456789"
                      keyboardType="phone-pad"
                      value={fatherPhone}
                      onChangeText={setFatherPhone}
                      {...inputCommon}
                      style={inputStyle}
                    />

                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionLabel}>MOTHER (OPTIONAL)</Text>
                    </View>
                    <InputField
                      label="Mother's Maiden Name"
                      placeholder="Maria Santos"
                      value={motherName}
                      onChangeText={setMotherName}
                      {...inputCommon}
                      style={inputStyle}
                    />
                    <InputField
                      label="Mother's Phone Number"
                      placeholder="09123456789"
                      keyboardType="phone-pad"
                      value={motherPhone}
                      onChangeText={setMotherPhone}
                      {...inputCommon}
                      style={inputStyle}
                    />

                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionLabel}>ID UPLOAD</Text>
                    </View>
                    {!idPhotoUploaded ? (
                      <TouchableOpacity style={styles.uploadBox} onPress={pickIdPhoto}>
                        <Ionicons name="camera-outline" size={36} color="#94A3B8" />
                        <Text style={{ fontSize: 14, fontWeight: "600", color: "#17202b", marginTop: 8 }}>
                          Upload ID Photo
                        </Text>
                        <Text style={{ fontSize: 12, color: "#64748B", textAlign: "center", marginTop: 4 }}>
                          Take a photo of your valid ID
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.uploadedBox}>
                        <Ionicons name="checkmark-circle" size={28} color="#22C55E" />
                        <Text style={{ fontSize: 14, fontWeight: "600", color: "#16A34A", marginLeft: 8 }}>
                          ID Photo Uploaded
                        </Text>
                      </View>
                    )}
                  </>
                )}

                {step === 4 && (
                  <>
                    {location ? (
                      <>
                        <Text style={styles.inputLabel}>Your GPS Location</Text>
                        <View style={styles.mapContainer}>
                          <MapView
                            style={{ width: "100%", height: 280, borderRadius: 14 }}
                            mapType="none"
                            mapStyle={mapStyle}
                            initialRegion={{
                              latitude: location.latitude,
                              longitude: location.longitude,
                              latitudeDelta: 0.005,
                              longitudeDelta: 0.005,
                            }}
                            onPress={isPinning ? handleMapPress : undefined}
                          >
                            <UrlTile urlTemplate={tileUrl} />
                            <Marker
                              coordinate={{
                                latitude: (isPinning ? pinnedLocation : location)?.latitude ?? location.latitude,
                                longitude: (isPinning ? pinnedLocation : location)?.longitude ?? location.longitude,
                              }}
                              title={isPinning ? "Drag to adjust" : "Your Location"}
                              pinColor={isPinning ? "#F59E0B" : "#1565C0"}
                              draggable={isPinning}
                              onDragEnd={handleMarkerDragEnd}
                            />
                          </MapView>
                        </View>

                        {isPinning && (
                          <View style={[styles.locationBox, { backgroundColor: "#FFFBEB", borderColor: "#F59E0B", marginTop: 12 }]}>
                            <Ionicons name="finger-print" size={20} color="#F59E0B" />
                            <Text style={{ marginLeft: 8, color: "#D97706", flex: 1, fontSize: 13 }}>
                              Tap the map or drag the pin to set your exact location.
                            </Text>
                          </View>
                        )}

                        {isPinning && pinnedLocation && pinnedAddress ? (
                          <View style={[styles.locationBox, {
                            backgroundColor: isPinValid ? "#F0FDF4" : "#FEF2F2",
                            borderColor: isPinValid ? "#22C55E" : "#DC2626",
                            marginTop: 8,
                          }]}>
                            <Ionicons
                              name={isPinValid ? "checkmark-circle" : "alert-circle"}
                              size={20}
                              color={isPinValid ? "#22C55E" : "#DC2626"}
                            />
                            <View style={{ marginLeft: 8, flex: 1 }}>
                              <Text style={{ color: isPinValid ? "#16A34A" : "#DC2626", fontSize: 12, fontWeight: "600" }}>
                                {isPinValid ? "Location is within Calbayog City" : "Location is outside Calbayog City"}
                              </Text>
                              <Text style={{ color: "#64748B", fontSize: 11, marginTop: 2 }}>
                                {pinnedAddress}
                              </Text>
                            </View>
                          </View>
                        ) : null}

                        <Text style={[styles.inputLabel, { marginTop: 12 }]}>
                          Registered Address
                        </Text>
                        <View style={styles.addressCard}>
                          <Ionicons name="home-outline" size={20} color="#0F204B" />
                          <Text style={{ marginLeft: 10, color: "#17202b", flex: 1, fontSize: 14 }}>
                            {street}, Brgy. {barangay}, Calbayog City, Samar
                          </Text>
                        </View>

                        {!isPinning ? (
                          <TouchableOpacity
                            style={[styles.locationBox, { backgroundColor: "#EFF6FF", borderColor: "#1565C0", marginTop: 12 }]}
                            onPress={startPinning}
                          >
                            <Ionicons name="finger-print" size={20} color="#1565C0" />
                            <Text style={{ marginLeft: 8, color: "#1565C0", flex: 1, fontSize: 13, fontWeight: "600" }}>
                              Pin Exact Location (if GPS is inaccurate)
                            </Text>
                            <Ionicons name="chevron-forward" size={18} color="#1565C0" />
                          </TouchableOpacity>
                        ) : (
                          <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                            <TouchableOpacity
                              style={{
                                flex: 1,
                                paddingVertical: 14,
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: "#E5E5EA",
                                alignItems: "center",
                              }}
                              onPress={() => { setIsPinning(false); setPinnedLocation(null); setPinnedAddress(""); setIsPinValid(null); }}
                            >
                              <Text style={{ color: "#64748B", fontSize: 14, fontWeight: "600" }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={{
                                flex: 1,
                                paddingVertical: 14,
                                borderRadius: 12,
                                backgroundColor: isPinValid ? "#22C55E" : "#E5E5EA",
                                alignItems: "center",
                              }}
                              onPress={usePinnedLocation}
                              disabled={!isPinValid}
                            >
                              <Text style={{ color: isPinValid ? "#FFFFFF" : "#999999", fontSize: 14, fontWeight: "600" }}>
                                Confirm Pin
                              </Text>
                            </TouchableOpacity>
                          </View>
                        )}

                        <View style={[styles.locationBox, { backgroundColor: "#F0FDF4", borderColor: "#22C55E", marginTop: 12 }]}>
                          <Ionicons name="information-circle" size={20} color="#22C55E" />
                          <Text style={{ marginLeft: 8, color: "#16A34A", flex: 1, fontSize: 13 }}>
                            {isPinning
                              ? "Ensure the pin is at your exact address within Calbayog City."
                              : "Verify that the map pin matches your address above. You can pin manually if GPS is inaccurate."}
                          </Text>
                        </View>
                      </>
                    ) : (
                      <View style={{ alignItems: "center", padding: 40 }}>
                        <Ionicons name="locate-outline" size={48} color="#94A3B8" />
                        <Text style={{ marginTop: 16, color: "#64748B", textAlign: "center" }}>
                          No location data available. Please go back to step 2 and allow location access.
                        </Text>
                      </View>
                    )}
                  </>
                )}

                {step === 5 && (
                  <>
                    <View style={{ alignItems: "center", marginBottom: 20 }}>
                      <Ionicons name="mail-outline" size={48} color="#94A3B8" />
                      <Text style={{ fontSize: 15, color: "#64748B", textAlign: "center", marginTop: 12 }}>
                        A verification code will be sent to{"\n"}
                        <Text style={{ fontWeight: "700", color: "#17202b" }}>{email}</Text>
                      </Text>
                    </View>

                    {!otpSent ? (
                      <Button
                        title="Send OTP Code"
                        onPress={sendOtp}
                        disabled={isLoading}
                        textStyle={{ color: "#FFFFFF" }}
                        style={{ borderRadius: 999, backgroundColor: "#0F204B", height: 50 }}
                      />
                    ) : !otpVerified ? (
                      <>
                        <InputField
                          label="Enter 8-Digit Code"
                          placeholder="00000000"
                          placeholderTextColor="#94A3B8"
                          keyboardType="number-pad"
                          maxLength={8}
                          value={otpCode}
                          onChangeText={setOtpCode}
                          labelStyle={{ color: "#64748B" }}
                          style={inputStyle}
                        />
                        <View style={{ marginTop: 12, gap: 10 }}>
                          <Button
                            title="Verify Code"
                            onPress={verifyOtp}
                            disabled={otpCode.length !== 8}
                            loading={isLoading}
                            textStyle={{ color: "#FFFFFF" }}
                            style={{ borderRadius: 999, backgroundColor: "#0F204B", height: 50 }}
                          />
                          <TouchableOpacity onPress={sendOtp} disabled={isLoading}>
                            <Text style={{ color: "#1565C0", textAlign: "center", fontSize: 14 }}>
                              Resend Code
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    ) : (
                      <View style={styles.verifiedContainer}>
                        <Ionicons name="checkmark-circle" size={56} color="#22C55E" />
                        <Text style={{ fontSize: 18, fontWeight: "700", color: "#16A34A", marginTop: 12 }}>
                          Email Verified!
                        </Text>
                        <Text style={{ fontSize: 14, color: "#64748B", marginTop: 4, textAlign: "center" }}>
                          Your email has been verified successfully.
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </View>

              <View>
                <Button
                  title={step < TOTAL_STEPS ? "Continue" : "Complete Registration"}
                  onPress={step < TOTAL_STEPS ? handleNext : handleRegister}
                  disabled={isLoading || (step === 5 && !otpVerified)}
                  textStyle={{ color: "#FFFFFF" }}
                  style={{ borderRadius: 999, backgroundColor: "#0F204B", height: 50 }}
                />
                <Button
                  title={step === 1 ? "Back to Login" : "Previous Step"}
                  variant="outline"
                  onPress={handleBack}
                  disabled={isLoading}
                  textStyle={{ color: "#0F204B" }}
                  style={{ borderRadius: 999, height: 50, borderColor: "#E5E5EA", backgroundColor: "transparent", marginTop: 10 }}
                />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  stepRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F5F7FA",
    justifyContent: "center",
    alignItems: "center",
  },
  stepCircleDone: {
    backgroundColor: "#0F204B",
  },
  stepCircleCurrent: {
    backgroundColor: "#0F204B",
    shadowColor: "#0F204B",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  stepNumber: {
    fontSize: 13,
    fontWeight: "700",
    color: "#94A3B8",
  },
  stepNumberActive: {
    color: "#FFFFFF",
  },
  stepLine: {
    width: 28,
    height: 2,
    backgroundColor: "#E5E5EA",
    marginHorizontal: 6,
  },
  stepLineActive: {
    backgroundColor: "#0F204B",
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
    marginBottom: 6,
    marginTop: 4,
  },
  pickerButton: {
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
    paddingHorizontal: 0,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "transparent",
    marginBottom: 14,
  },
  pickerText: {
    fontSize: 15,
    color: "#11181C",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "70%",
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  barangayItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F4F8",
  },
  barangayText: {
    fontSize: 15,
    color: "#11181C",
  },
  locationBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
  },
  mapContainer: {
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  addressCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  uploadBox: {
    alignItems: "center",
    padding: 24,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    borderStyle: "dashed",
    marginTop: 4,
  },
  uploadedBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    backgroundColor: "#F0FDF4",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#22C55E",
    marginTop: 4,
  },
  verifiedContainer: {
    alignItems: "center",
    padding: 24,
  },
  sectionHeader: {
    marginTop: 8,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
    paddingBottom: 6,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
    letterSpacing: 1,
  },
});
