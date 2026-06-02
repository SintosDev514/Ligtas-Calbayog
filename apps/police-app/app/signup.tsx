import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StatusBar,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useAuth, SignUpData } from "../context/AuthContext";
import { authStyles as s } from "./styles/Auth.styles";

const RANKS = [
  "Patrolman",
  "Corporal",
  "Sergeant",
  "Lieutenant",
  "Captain",
  "Major",
  "Colonel",
];

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState("");
  const [badgeId, setBadgeId] = useState("");
  const [rank, setRank] = useState("");
  const [station, setStation] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [policeIdUri, setPoliceIdUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Gallery access is required to upload Police ID.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!result.canceled) setPoliceIdUri(result.assets[0].uri);
  };

  const handleSignUp = async () => {
    if (!fullName.trim() || !badgeId.trim() || !rank || !station.trim() || !email.trim() || !password) {
      setError("Please fill in all required fields.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setError("");
    try {
      setSubmitting(true);
      const data: SignUpData = {
        fullName: fullName.trim(),
        badgeId: badgeId.trim(),
        rank,
        station: station.trim(),
        email: email.trim(),
        password,
        phoneNumber: phoneNumber.trim(),
        policeIdPhotoUri: policeIdUri,
      };
      await signUp(data);
      Alert.alert(
        "Registration Submitted",
        "Your account has been created. You may now sign in.",
      );
      router.replace("/");
    } catch (err: any) {
      setError(err.message || "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.logoSection}>
          <View style={s.badge}>
            <Ionicons name="shield-checkmark" size={32} color="#F4B51A" />
          </View>
          <Text style={s.appName}>Police Registration</Text>
          <Text style={s.appSub}>Create your official account</Text>
        </View>

        <View style={s.form}>
          <View>
            <Text style={s.label}>Full Name *</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. Juan M. Dela Cruz"
              placeholderTextColor="#94A3B8"
              value={fullName}
              onChangeText={setFullName}
            />
          </View>

          <View style={s.row}>
            <View style={s.half}>
              <Text style={s.label}>Badge ID *</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. PNP-12345"
                placeholderTextColor="#94A3B8"
                value={badgeId}
                onChangeText={setBadgeId}
              />
            </View>
            <View style={s.half}>
              <Text style={s.label}>Phone</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. 09171234567"
                placeholderTextColor="#94A3B8"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          <View>
            <Text style={s.label}>Rank *</Text>
            <View style={s.pickerRow}>
              {RANKS.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[s.pickerChip, rank === r && s.pickerChipActive]}
                  onPress={() => setRank(r)}
                >
                  <Text style={[s.pickerChipText, rank === r && s.pickerChipTextActive]}>
                    {r}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View>
            <Text style={s.label}>Station *</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. Calbayog City Police Station"
              placeholderTextColor="#94A3B8"
              value={station}
              onChangeText={setStation}
            />
          </View>

          <View style={s.row}>
            <View style={s.half}>
              <Text style={s.label}>Email *</Text>
              <TextInput
                style={s.input}
                placeholder="email@example.com"
                placeholderTextColor="#94A3B8"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>
            <View style={s.half}>
              <Text style={s.label}>Password *</Text>
              <View style={{ position: "relative" }}>
                <TextInput
                  style={[s.input, { paddingRight: 36 }]}
                  placeholder="Min 6 chars"
                  placeholderTextColor="#94A3B8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  style={{ position: "absolute", right: 10, top: 10 }}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons
                    name={showPassword ? "eye-off" : "eye"}
                    size={18}
                    color="#94A3B8"
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View>
            <Text style={s.label}>Upload Police ID</Text>
            {policeIdUri ? (
              <TouchableOpacity style={s.uploadPreview} onPress={pickImage}>
                <Image source={{ uri: policeIdUri }} style={s.uploadPreviewImage} resizeMode="cover" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={s.uploadBtn} onPress={pickImage}>
                <Ionicons name="camera" size={22} color="#64748B" />
                <Text style={s.uploadBtnText}>Tap to upload Police ID</Text>
              </TouchableOpacity>
            )}
          </View>

          {error ? <Text style={s.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[s.actionBtn, submitting && s.actionBtnDisabled]}
            onPress={handleSignUp}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={s.actionBtnText}>Create Account</Text>
            )}
          </TouchableOpacity>

          <View style={s.linkRow}>
            <Text style={s.linkText}>Already have an account?</Text>
            <TouchableOpacity onPress={() => router.replace("/")}>
              <Text style={s.linkAction}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
