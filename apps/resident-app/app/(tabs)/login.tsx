import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Animated,
  ScrollView,
  StatusBar,
  Image,
  Text,
  TextInput,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { loginUser } from "../../../../shared/services/authService";
import { supabase } from "../../../../shared/supabase/supabaseClient";
import { InputField } from "../../components/ui/InputField";
import { Button } from "../../components/ui/Button";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

type ModalType = "banned" | "suspended" | "access_denied" | null;

export default function Login() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const [modalType, setModalType] = useState<ModalType>(null);
  const modalAnim = useRef(new Animated.Value(0)).current;
  const modalOverlayAnim = useRef(new Animated.Value(0)).current;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

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
  }, []);

  const showModal = (type: ModalType) => {
    setModalType(type);
    Animated.parallel([
      Animated.timing(modalOverlayAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.spring(modalAnim, {
        toValue: 1,
        friction: 8,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const hideModal = () => {
    Animated.parallel([
      Animated.timing(modalOverlayAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(modalAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setModalType(null);
    });
  };

  const getModalConfig = () => {
    switch (modalType) {
      case "banned":
        return {
          icon: "shield-checkmark" as const,
          iconBg: "#FEF2F2",
          iconColor: "#DC2626",
          accentColor: "#DC2626",
          title: "Account Banned",
          message: "Your account has been permanently banned due to a violation of our community guidelines. This action is irreversible.",
          footerNote: "If you believe this is an error, contact support.",
          buttonLabel: "Understood",
        };
      case "suspended":
        return {
          icon: "pause-circle" as const,
          iconBg: "#FFFBEB",
          iconColor: "#D97706",
          accentColor: "#D97706",
          title: "Account Suspended",
          message: "Your account has been temporarily suspended. You will not be able to access the app during this period.",
          footerNote: "Please wait until the suspension is lifted.",
          buttonLabel: "Got It",
        };
      case "access_denied":
        return {
          icon: "close-circle" as const,
          iconBg: "#EFF6FF",
          iconColor: "#1565C0",
          accentColor: "#1565C0",
          title: "Access Denied",
          message: "This account does not have resident privileges. Please use a valid resident account to continue.",
          footerNote: null,
          buttonLabel: "Try Again",
        };
      default:
        return null;
    }
  };

  const validateEmail = (value: string) => {
    if (!value) return "Email is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Enter a valid email";
    return "";
  };

  const validatePassword = (value: string) => {
    if (!value) return "Password is required";
    if (value.length < 6) return "Min 6 characters";
    return "";
  };

  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (emailError) setEmailError(validateEmail(text));
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    if (passwordError) setPasswordError(validatePassword(text));
  };

  const handleLogin = async () => {
    const emailErr = validateEmail(email);
    const passErr = validatePassword(password);
    setEmailError(emailErr);
    setPasswordError(passErr);
    if (emailErr || passErr) return;

    setIsLoading(true);
    try {
      const user = await loginUser(email, password);
      if (!user) {
        Alert.alert("Error", "User profile not found.");
        return;
      }
      if (user.role !== "resident") {
        showModal("access_denied");
        return;
      }
      if (user.status === "banned") {
        await supabase.auth.signOut();
        showModal("banned");
        return;
      }
      if (user.status === "suspended") {
        await supabase.auth.signOut();
        showModal("suspended");
        return;
      }
      await AsyncStorage.setItem("@ligtas_login_timestamp", Date.now().toString());
      router.replace("/(tabs)/home" as any);
    } catch (err: any) {
      Alert.alert("Login Failed", err.message || "Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const modalConfig = getModalConfig();

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
              paddingBottom: 28,
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
                style={{ width: 60, height: 60 }}
                resizeMode="contain"
              />
              <Text style={{ fontSize: 18, fontWeight: "800", color: "#FFFFFF", marginTop: 4, letterSpacing: 0.5 }}>
                Ligtas Calbayog
              </Text>
              <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 1, letterSpacing: 0.3 }}>
                Your Safety, Our Priority
              </Text>
            </View>

            {/* Floating white card */}
            <Animated.View
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 24,
                padding: 28,
                marginTop: 20,
                marginHorizontal: 16,
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.12,
                shadowRadius: 14,
                elevation: 8,
                borderWidth: 1,
                borderColor: "#E8EEF5",
              }}
            >
              {/* Pill toggle */}
              <View style={{
                flexDirection: "row",
                backgroundColor: "#F5F7FA",
                borderRadius: 999,
                padding: 4,
                marginBottom: 32,
              }}>
                <View style={{
                  flex: 1,
                  backgroundColor: "#0F204B",
                  borderRadius: 999,
                  paddingVertical: 10,
                  alignItems: "center",
                }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#FFFFFF" }}>Login</Text>
                </View>
                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: 10, alignItems: "center" }}
                  onPress={() => router.push("/register")}
                >
                  <Text style={{ fontSize: 14, fontWeight: "600", color: "#94A3B8" }}>Sign Up</Text>
                </TouchableOpacity>
              </View>

              {/* Inputs */}
              <InputField
                label="Email Address"
                placeholder="name@example.com"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={handleEmailChange}
                error={emailError}
                labelStyle={{ color: "#64748B" }}
                style={{
                  backgroundColor: "transparent",
                  borderWidth: 0,
                  borderBottomWidth: 1,
                  borderBottomColor: "#E5E5EA",
                  borderRadius: 0,
                  color: "#11181C",
                  paddingHorizontal: 0,
                  paddingVertical: 12,
                }}
              />

              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 14, color: "#64748B", marginBottom: 6, fontWeight: "600" }}>
                  Password
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <TextInput
                    placeholder="Enter your password"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={handlePasswordChange}
                    style={{
                      flex: 1,
                      backgroundColor: "transparent",
                      borderWidth: 0,
                      borderBottomWidth: 1,
                      borderBottomColor: passwordError ? "#C1121F" : "#E5E5EA",
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
                {passwordError ? (
                  <Text style={{ color: "#C1121F", fontSize: 12, marginTop: 4 }}>
                    {passwordError}
                  </Text>
                ) : null}
              </View>

              <TouchableOpacity
                onPress={() => router.push("/forgot-password")}
                style={{ alignSelf: "flex-end", marginBottom: 32, marginTop: 4 }}
              >
                <Text style={{ fontSize: 13, fontWeight: "500", color: "#1565C0" }}>
                  Forgot Password?
                </Text>
              </TouchableOpacity>

              <Button
                title="Sign In"
                onPress={handleLogin}
                loading={isLoading}
                textStyle={{ color: "#FFFFFF" }}
                style={{
                  borderRadius: 999,
                  height: 52,
                  backgroundColor: "#0F204B",
                }}
              />
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Professional Status Modal */}
      <Modal visible={modalType !== null} transparent animationType="none" onRequestClose={hideModal}>
        <Animated.View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            alignItems: "center",
            opacity: modalOverlayAnim,
            paddingHorizontal: 32,
          }}
        >
          <Animated.View
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 24,
              width: "100%",
              maxWidth: 360,
              overflow: "hidden",
              transform: [{
                scale: modalAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.85, 1],
                }),
              }],
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 16 },
              shadowOpacity: 0.2,
              shadowRadius: 24,
              elevation: 16,
            }}
          >
            {/* Colored top accent bar — hidden for banned and suspended */}
            {modalConfig && modalType !== "banned" && modalType !== "suspended" && (
              <View style={{
                height: 4,
                backgroundColor: modalConfig.accentColor,
              }} />
            )}

            <View style={{ padding: 28, alignItems: "center" }}>
              {/* Icon circle */}
              {modalConfig && (
                <View style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: modalConfig.iconBg,
                  justifyContent: "center",
                  alignItems: "center",
                  marginBottom: 20,
                }}>
                  <Ionicons
                    name={modalConfig.icon}
                    size={36}
                    color={modalConfig.iconColor}
                  />
                </View>
              )}

              {/* Title */}
              {modalConfig && (
                <Text style={{
                  fontSize: 20,
                  fontWeight: "800",
                  color: "#17202b",
                  textAlign: "center",
                  marginBottom: 8,
                }}>
                  {modalConfig.title}
                </Text>
              )}

              {/* Divider */}
              {modalConfig && (
                <View style={{
                  width: 40,
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: modalConfig.accentColor,
                  opacity: 0.3,
                  marginBottom: 16,
                }} />
              )}

              {/* Message */}
              {modalConfig && (
                <Text style={{
                  fontSize: 14,
                  color: "#64748B",
                  textAlign: "center",
                  lineHeight: 21,
                  marginBottom: 12,
                }}>
                  {modalConfig.message}
                </Text>
              )}

              {/* Footer note */}
              {modalConfig?.footerNote && (
                <View style={{
                  backgroundColor: "#F8FAFC",
                  borderRadius: 12,
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  marginBottom: 24,
                  width: "100%",
                }}>
                  <Text style={{
                    fontSize: 12,
                    color: "#94A3B8",
                    textAlign: "center",
                    fontStyle: "italic",
                  }}>
                    {modalConfig.footerNote}
                  </Text>
                </View>
              )}

              {!modalConfig?.footerNote && <View style={{ marginBottom: 24 }} />}

              {/* Action button */}
              {modalConfig && (
                <TouchableOpacity
                  onPress={hideModal}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: modalConfig.accentColor,
                    borderRadius: 999,
                    paddingVertical: 14,
                    paddingHorizontal: 40,
                    width: "100%",
                    shadowColor: modalConfig.accentColor,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 4,
                  }}
                >
                  <Text style={{
                    fontSize: 15,
                    fontWeight: "700",
                    color: "#FFFFFF",
                    textAlign: "center",
                    letterSpacing: 0.3,
                  }}>
                    {modalConfig.buttonLabel}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
    </View>
  );
}
