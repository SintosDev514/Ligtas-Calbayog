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
} from "react-native";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import MapView, { Marker, UrlTile } from "@/components/MapView";
import { registerResident } from "../../../../shared/services/authService";
import { ScreenWrapper } from "../../components/ui/ScreenWrapper";
import { InputField } from "../../components/ui/InputField";
import { Button } from "../../components/ui/Button";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMapStyle } from "../../context/MapStyleContext";

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

  const [idPhotoUri, setIdPhotoUri] = useState<string | null>(null);
  const [idPhotoUploaded, setIdPhotoUploaded] = useState(false);

  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [storedOtp, setStoredOtp] = useState("");

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
      const code = String(Math.floor(100000 + Math.random() * 900000));
      setStoredOtp(code);

      let sent = false;
      try {
        const { error } = await supabase.functions.invoke("send-otp", {
          body: { email },
        });
        if (error) throw error;
        sent = true;
      } catch {
        Alert.alert("OTP Code", `Your verification code is: ${code}\n\n(In production, this will be sent to ${email})`);
        sent = true;
      }

      if (sent) {
        setOtpSent(true);
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to send OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = () => {
    if (otpCode === storedOtp) {
      setOtpVerified(true);
      Alert.alert("Verified", "Email verified successfully!");
    } else {
      Alert.alert("Invalid Code", "The code you entered is incorrect. Please try again.");
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

      await registerResident({
        email,
        password,
        fullName,
        address: formattedAddress,
        phoneNumber,
        emergencyContact,
        guardianName,
        guardianPhone,
        fatherName: fatherName || null,
        fatherPhone: fatherPhone || null,
        motherName: motherName || null,
        motherPhone: motherPhone || null,
        latitude: location?.latitude ?? null,
        longitude: location?.longitude ?? null,
        idPhotoUri,
      });
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

  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <SafeAreaView style={{ flex: 1 }}>
        <ScreenWrapper scrollable>
          <View style={{ flex: 1, paddingVertical: 10 }}>
            <View style={{ alignItems: "center", marginBottom: 16 }}>
              <Image
                source={require("../../assets/images/logo-black.png")}
                style={{ width: 56, height: 56 }}
                resizeMode="contain"
              />
              <Text style={{ fontSize: 20, fontWeight: "700", color: "#17202b", marginTop: 8 }}>
                Create Account
              </Text>
              <Text style={{ fontSize: 13, color: "#94A3B8", marginTop: 2 }}>
                Step {step} of {TOTAL_STEPS}
              </Text>
            </View>

            <View style={styles.stepRow}>
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.stepDot,
                    i + 1 <= step && styles.stepDotActive,
                    i + 1 === step && styles.stepDotCurrent,
                  ]}
                />
              ))}
            </View>

            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#17202b" }}>
                {stepTitles[step - 1]}
              </Text>
              <Text style={{ fontSize: 13, color: "#94A3B8", marginTop: 2 }}>
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
                  />
                  <InputField
                    label="Password"
                    placeholder="Create a password (min 6 characters)"
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                  />
                </>
              )}

              {step === 2 && (
                <>
                  <InputField
                    label="Full Name"
                    placeholder="Juan Dela Cruz"
                    value={fullName}
                    onChangeText={setFullName}
                  />
                  <InputField
                    label="Phone Number"
                    placeholder="09123456789"
                    keyboardType="phone-pad"
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                  />
                  <InputField
                    label="Emergency Contact"
                    placeholder="Emergency contact phone number"
                    keyboardType="phone-pad"
                    value={emergencyContact}
                    onChangeText={setEmergencyContact}
                  />
                  <InputField
                    label="Street / House No."
                    placeholder="123 Mabini St."
                    value={street}
                    onChangeText={setStreet}
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
                    style={{ backgroundColor: "#F1F5F9", color: "#64748B" }}
                  />

                  <View style={{ marginTop: 12 }}>
                    <Text style={styles.inputLabel}>Current Location</Text>
                    {locationStatus === "loading" && (
                      <View style={styles.locationBox}>
                        <Ionicons name="locate" size={20} color="#1565C0" />
                        <Text style={{ marginLeft: 8, color: "#64748B" }}>Getting your location...</Text>
                      </View>
                    )}
                    {locationStatus === "got" && location && (
                      <View style={[styles.locationBox, { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }]}>
                        <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
                        <Text style={{ marginLeft: 8, color: "#16A34A" }}>
                          Location captured ({location.latitude.toFixed(4)}, {location.longitude.toFixed(4)})
                        </Text>
                      </View>
                    )}
                    {locationStatus === "denied" && (
                      <View style={[styles.locationBox, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
                        <Ionicons name="alert-circle" size={20} color="#DC2626" />
                        <Text style={{ marginLeft: 8, color: "#DC2626", flex: 1 }}>
                          Location permission denied. Enable it in settings.
                        </Text>
                      </View>
                    )}
                    {locationStatus === "idle" && (
                      <TouchableOpacity style={styles.locationBox} onPress={getLocation}>
                        <Ionicons name="locate-outline" size={20} color="#1565C0" />
                        <Text style={{ marginLeft: 8, color: "#1565C0" }}>Tap to get current location</Text>
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
                            <Ionicons name="close" size={24} color="#64748B" />
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
                                <Ionicons name="checkmark-circle" size={22} color="#17202b" />
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
                  />
                  <InputField
                    label="Guardian's Phone Number"
                    placeholder="09123456789"
                    keyboardType="phone-pad"
                    value={guardianPhone}
                    onChangeText={setGuardianPhone}
                  />

                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionLabel}>FATHER (OPTIONAL)</Text>
                  </View>
                  <InputField
                    label="Father's Name"
                    placeholder="Pedro Dela Cruz"
                    value={fatherName}
                    onChangeText={setFatherName}
                  />
                  <InputField
                    label="Father's Phone Number"
                    placeholder="09123456789"
                    keyboardType="phone-pad"
                    value={fatherPhone}
                    onChangeText={setFatherPhone}
                  />

                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionLabel}>MOTHER (OPTIONAL)</Text>
                  </View>
                  <InputField
                    label="Mother's Maiden Name"
                    placeholder="Maria Santos"
                    value={motherName}
                    onChangeText={setMotherName}
                  />
                  <InputField
                    label="Mother's Phone Number"
                    placeholder="09123456789"
                    keyboardType="phone-pad"
                    value={motherPhone}
                    onChangeText={setMotherPhone}
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
                      <Text style={{ fontSize: 12, color: "#94A3B8", textAlign: "center", marginTop: 4 }}>
                        Take a photo of your valid ID
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.uploadedBox}>
                      <Ionicons name="checkmark-circle" size={28} color="#16A34A" />
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
                        >
                          <UrlTile urlTemplate={tileUrl} />
                          <Marker
                            coordinate={{
                              latitude: location.latitude,
                              longitude: location.longitude,
                            }}
                            title="Your Location"
                            pinColor="#1565C0"
                          />
                        </MapView>
                      </View>
                      <Text style={[styles.inputLabel, { marginTop: 12 }]}>
                        Registered Address
                      </Text>
                      <View style={styles.addressCard}>
                        <Ionicons name="home-outline" size={20} color="#17202b" />
                        <Text style={{ marginLeft: 10, color: "#17202b", flex: 1, fontSize: 14 }}>
                          {street}, Brgy. {barangay}, Calbayog City, Samar
                        </Text>
                      </View>
                      <View style={[styles.locationBox, { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE", marginTop: 12 }]}>
                        <Ionicons name="information-circle" size={20} color="#1565C0" />
                        <Text style={{ marginLeft: 8, color: "#1565C0", flex: 1, fontSize: 13 }}>
                          Verify that the map pin matches your address above.
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
                    <Ionicons name="mail-outline" size={48} color="#1565C0" />
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
                      style={{ borderRadius: 12, backgroundColor: "#17202b", height: 50 }}
                    />
                  ) : !otpVerified ? (
                    <>
                      <InputField
                        label="Enter 6-Digit Code"
                        placeholder="000000"
                        keyboardType="number-pad"
                        maxLength={6}
                        value={otpCode}
                        onChangeText={setOtpCode}
                      />
                      <View style={{ marginTop: 12, gap: 10 }}>
                        <Button
                          title="Verify Code"
                          onPress={verifyOtp}
                          disabled={otpCode.length !== 6}
                          style={{ borderRadius: 12, backgroundColor: "#17202b", height: 50 }}
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
                      <Ionicons name="checkmark-circle" size={56} color="#16A34A" />
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
                style={{ borderRadius: 12, backgroundColor: "#17202b", height: 50 }}
              />
              <Button
                title={step === 1 ? "Back to Login" : "Previous Step"}
                variant="outline"
                onPress={handleBack}
                disabled={isLoading}
                style={{ borderRadius: 12, height: 50, borderColor: "#E8EEF5", marginTop: 10 }}
              />
            </View>
          </View>
        </ScreenWrapper>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  stepRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 24,
    gap: 8,
  },
  stepDot: {
    height: 6,
    width: 28,
    borderRadius: 3,
    backgroundColor: "#E2E8F0",
  },
  stepDotActive: {
    backgroundColor: "#17202b",
  },
  stepDotCurrent: {
    width: 40,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
    marginBottom: 6,
    marginTop: 4,
  },
  pickerButton: {
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 6,
    paddingHorizontal: 12,
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    marginBottom: 14,
  },
  pickerText: {
    fontSize: 15,
    color: "#17202b",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFF",
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
    borderBottomColor: "#F1F5F9",
  },
  barangayItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC",
  },
  barangayText: {
    fontSize: 15,
    color: "#17202b",
  },
  locationBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
  },
  mapContainer: {
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  addressCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  uploadBox: {
    alignItems: "center",
    padding: 24,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
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
    borderColor: "#BBF7D0",
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
    borderBottomColor: "#E8EEF5",
    paddingBottom: 6,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 1,
  },
});
