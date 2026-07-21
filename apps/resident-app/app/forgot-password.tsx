import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  StatusBar,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../../../shared/supabase/supabaseClient";

type Step = "email" | "otp" | "password" | "success";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  React.useEffect(() => {
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
  }, []);

  const handleSendOtp = async () => {
    if (!email.trim()) {
      Alert.alert("Error", "Please enter your email address.");
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false },
      });
      if (error) throw error;
      setStep("otp");
      Alert.alert("OTP Sent", `A verification code has been sent to ${email}`);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to send OTP.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 8) {
      Alert.alert("Error", "Please enter the 8-digit code.");
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otpCode,
        type: "email",
      });
      if (error) throw error;
      setStep("password");
    } catch (err: any) {
      Alert.alert("Invalid Code", "The code you entered is incorrect. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match.");
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      await AsyncStorage.removeItem("@ligtas_login_timestamp");
      await supabase.auth.signOut();
      setStep("success");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to reset password.");
    } finally {
      setIsLoading(false);
    }
  };

  const subtitleText = () => {
    switch (step) {
      case "email":
        return "Enter your email and we'll send you a code to reset your password.";
      case "otp":
        return `Enter the 8-digit code sent to ${email}`;
      case "password":
        return "Enter your new password.";
      case "success":
        return "Your password has been reset successfully.";
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 28, paddingVertical: 40 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Back button */}
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#17202b" />
            </TouchableOpacity>

            <Animated.View
              style={{
                alignItems: "center",
                marginBottom: 32,
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              }}
            >
              <Image
                source={require("../assets/images/logo-black.png")}
                style={{ width: 88, height: 88 }}
                resizeMode="contain"
              />
              <Text style={styles.title}>Forgot Password?</Text>
              <Text style={styles.subtitle}>{subtitleText()}</Text>
            </Animated.View>

            {step === "email" && (
              <Animated.View
                style={{
                  backgroundColor: "#F8FAFC",
                  borderRadius: 20,
                  padding: 24,
                  borderWidth: 1,
                  borderColor: "#E8EEF5",
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                }}
              >
                <Text style={styles.inputLabel}>Email Address</Text>
                <View style={styles.inputRow}>
                  <Ionicons name="mail-outline" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.input}
                    placeholder="name@example.com"
                    placeholderTextColor="#94A3B8"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.primaryBtn, isLoading && { opacity: 0.7 }]}
                  onPress={handleSendOtp}
                  disabled={isLoading}
                  activeOpacity={0.85}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Send OTP Code</Text>
                  )}
                </TouchableOpacity>
              </Animated.View>
            )}

            {step === "otp" && (
              <Animated.View
                style={{
                  backgroundColor: "#F8FAFC",
                  borderRadius: 20,
                  padding: 24,
                  borderWidth: 1,
                  borderColor: "#E8EEF5",
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                }}
              >
                <View style={{ alignItems: "center", marginBottom: 16 }}>
                  <Ionicons name="mail-unread-outline" size={40} color="#17202b" />
                </View>

                <Text style={styles.inputLabel}>Enter 8-Digit Code</Text>
                <View style={styles.inputRow}>
                  <Ionicons name="lock-closed-outline" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.input}
                    placeholder="00000000"
                    placeholderTextColor="#94A3B8"
                    keyboardType="number-pad"
                    maxLength={8}
                    value={otpCode}
                    onChangeText={setOtpCode}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.primaryBtn, (isLoading || otpCode.length !== 8) && { opacity: 0.7 }]}
                  onPress={handleVerifyOtp}
                  disabled={isLoading || otpCode.length !== 8}
                  activeOpacity={0.85}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Verify Code</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity onPress={handleSendOtp} disabled={isLoading} style={{ marginTop: 14 }}>
                  <Text style={styles.resendText}>Resend Code</Text>
                </TouchableOpacity>
              </Animated.View>
            )}

            {step === "password" && (
              <Animated.View
                style={{
                  backgroundColor: "#F8FAFC",
                  borderRadius: 20,
                  padding: 24,
                  borderWidth: 1,
                  borderColor: "#E8EEF5",
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                }}
              >
                <Text style={styles.inputLabel}>New Password</Text>
                <View style={styles.inputRow}>
                  <Ionicons name="lock-open-outline" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.input}
                    placeholder="At least 6 characters"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry
                    value={newPassword}
                    onChangeText={setNewPassword}
                  />
                </View>

                <Text style={[styles.inputLabel, { marginTop: 16 }]}>Confirm New Password</Text>
                <View style={styles.inputRow}>
                  <Ionicons name="lock-open-outline" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.input}
                    placeholder="Re-enter new password"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.primaryBtn, isLoading && { opacity: 0.7 }]}
                  onPress={handleResetPassword}
                  disabled={isLoading}
                  activeOpacity={0.85}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Reset Password</Text>
                  )}
                </TouchableOpacity>
              </Animated.View>
            )}

            {step === "success" && (
              <Animated.View
                style={{
                  alignItems: "center",
                  backgroundColor: "#F8FAFC",
                  borderRadius: 20,
                  padding: 32,
                  borderWidth: 1,
                  borderColor: "#E8EEF5",
                  opacity: fadeAnim,
                }}
              >
                <Ionicons name="checkmark-circle" size={64} color="#16A34A" />
                <Text style={styles.successTitle}>Password Reset!</Text>
                <Text style={styles.successText}>
                  Your password has been reset successfully. You can now log in with your new password.
                </Text>
                <TouchableOpacity
                  style={styles.backToLoginBtn}
                  onPress={() => router.replace("/(tabs)/login" as any)}
                >
                  <Text style={styles.backToLoginText}>Back to Login</Text>
                </TouchableOpacity>
              </Animated.View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  backBtn: {
    backgroundColor: "#F1F5F9",
    borderRadius: 20,
    padding: 8,
    alignSelf: "flex-start",
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#17202b",
    marginTop: 16,
  },
  subtitle: {
    fontSize: 14,
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 50,
    backgroundColor: "#FFFFFF",
    marginBottom: 20,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: "#17202b",
  },
  primaryBtn: {
    backgroundColor: "#17202b",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  resendText: {
    color: "#64748B",
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
  },
  successTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#17202b",
    marginTop: 12,
    marginBottom: 8,
  },
  successText: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
  },
  backToLoginBtn: {
    marginTop: 24,
    backgroundColor: "#17202b",
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 14,
  },
  backToLoginText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
});
