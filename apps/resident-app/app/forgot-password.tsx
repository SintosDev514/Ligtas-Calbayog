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
import { supabase } from "../../../shared/supabase/supabaseClient";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
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

  const handleSend = async () => {
    if (!email.trim()) {
      Alert.alert("Error", "Please enter your email address.");
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) throw error;
      setSent(true);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to send reset email.");
    } finally {
      setIsLoading(false);
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
              <Text style={styles.subtitle}>
                Enter your email and we'll send you a link to reset your password.
              </Text>
            </Animated.View>

            {!sent ? (
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
                  style={[styles.sendBtn, isLoading && { opacity: 0.7 }]}
                  onPress={handleSend}
                  disabled={isLoading}
                  activeOpacity={0.85}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.sendText}>Send Reset Link</Text>
                  )}
                </TouchableOpacity>
              </Animated.View>
            ) : (
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
                <Text style={styles.successTitle}>Email Sent!</Text>
                <Text style={styles.successText}>
                  Check your inbox for a password reset link. It may take a few minutes to arrive.
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
  sendBtn: {
    backgroundColor: "#17202b",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  sendText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
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
