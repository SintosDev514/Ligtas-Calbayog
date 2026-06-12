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
} from "react-native";
import { useRouter } from "expo-router";
import { loginUser } from "../../../../shared/services/authService";
import { Typography } from "../../components/ui/Typography";
import { InputField } from "../../components/ui/InputField";
import { Button } from "../../components/ui/Button";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

export default function Login() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

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
        Alert.alert("Access Denied", "Use a resident account.");
        return;
      }
      if (user.status === "banned") {
        Alert.alert("Account Banned", "Your account has been permanently banned.");
        return;
      }
      if (user.status === "suspended") {
        Alert.alert("Account Suspended", "Your account has been temporarily suspended.");
        return;
      }
      router.replace("/(tabs)/home" as any);
    } catch (err: any) {
      Alert.alert("Login Failed", err.message || "Try again.");
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
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: "center",
              paddingHorizontal: 28,
              paddingVertical: 40,
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View
              style={{
                alignItems: "center",
                marginBottom: 36,
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              }}
            >
              <Image
                source={require("../../assets/images/logo-black.png")}
                style={{ width: 100, height: 100 }}
                resizeMode="contain"
              />
              <Text
                style={{
                  fontSize: 28,
                  fontWeight: "800",
                  color: "#17202b",
                  marginTop: 12,
                  letterSpacing: 0.5,
                }}
              >
                Ligtas Calbayog
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: "#94A3B8",
                  marginTop: 4,
                  fontWeight: "500",
                  letterSpacing: 2,
                  textTransform: "uppercase",
                }}
              >
                Community Safety Platform
              </Text>
            </Animated.View>

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
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: "700",
                  color: "#17202b",
                  marginBottom: 4,
                }}
              >
                Welcome Back
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: "#64748B",
                  marginBottom: 24,
                }}
              >
                Sign in to your resident account
              </Text>

              <InputField
                label="Email Address"
                placeholder="name@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={handleEmailChange}
                error={emailError}
              />

              <InputField
                label="Password"
                placeholder="Enter your password"
                secureTextEntry
                value={password}
                onChangeText={handlePasswordChange}
                error={passwordError}
              />

              <TouchableOpacity
                onPress={() => router.push("/forgot-password")}
                style={{ alignSelf: "flex-end", marginBottom: 24, marginTop: -4 }}
              >
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#1565C0" }}>
                  Forgot Password?
                </Text>
              </TouchableOpacity>

              <Button
                title="Sign In"
                onPress={handleLogin}
                loading={isLoading}
                style={{
                  borderRadius: 12,
                  height: 52,
                  backgroundColor: "#17202b",
                }}
              />
            </Animated.View>

            <Animated.View
              style={{
                marginTop: 28,
                alignItems: "center",
                opacity: fadeAnim,
              }}
            >
              <Text style={{ fontSize: 14, color: "#94A3B8" }}>
                Don't have an account?
              </Text>
              <TouchableOpacity
                onPress={() => router.push("/register")}
                style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "700",
                    color: "#F4B51A",
                  }}
                >
                  Create an Account
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={16}
                  color="#F4B51A"
                  style={{ marginLeft: 4 }}
                />
              </TouchableOpacity>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
