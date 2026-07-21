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
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { loginUser } from "../../../../shared/services/authService";
import { InputField } from "../../components/ui/InputField";
import { Button } from "../../components/ui/Button";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

export default function Login() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      await AsyncStorage.setItem("@ligtas_login_timestamp", Date.now().toString());
      router.replace("/(tabs)/home" as any);
    } catch (err: any) {
      Alert.alert("Login Failed", err.message || "Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#17202b" }}>
      <StatusBar barStyle="light-content" backgroundColor="#17202b" />
      <SafeAreaView style={{ flex: 1, backgroundColor: "#17202b" }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* White header section with curved bottom */}
            <View style={{
              backgroundColor: "#FFFFFF",
              justifyContent: "center",
              alignItems: "center",
              paddingTop: 24,
              paddingBottom: 24,
              borderBottomLeftRadius: 40,
              borderBottomRightRadius: 40,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 12,
              elevation: 8,
              zIndex: 1,
            }}>
              <Image
                source={require("../../assets/images/logo-black.png")}
                style={{ width: 60, height: 60 }}
                resizeMode="contain"
              />
              <Text style={{ fontSize: 18, fontWeight: "800", color: "#17202b", marginTop: 4, letterSpacing: 0.5 }}>
                Ligtas Calbayog
              </Text>
              <Text style={{ fontSize: 11, color: "#888", marginTop: 1, letterSpacing: 0.3 }}>
                Your Safety, Our Priority
              </Text>
            </View>

            {/* Floating dark card overlapping white and dark sections */}
            <Animated.View
              style={{
                backgroundColor: "#1E293B",
                borderRadius: 24,
                padding: 28,
                marginTop: 20,
                marginHorizontal: 16,
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.5,
                shadowRadius: 24,
                elevation: 16,
              }}
            >
              {/* Pill toggle */}
              <View style={{
                flexDirection: "row",
                backgroundColor: "#334155",
                borderRadius: 999,
                padding: 4,
                marginBottom: 32,
              }}>
                <View style={{
                  flex: 1,
                  backgroundColor: "#FFFFFF",
                  borderRadius: 999,
                  paddingVertical: 10,
                  alignItems: "center",
                }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#151515" }}>Login</Text>
                </View>
                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: 10, alignItems: "center" }}
                  onPress={() => router.push("/register")}
                >
                  <Text style={{ fontSize: 14, fontWeight: "600", color: "#888" }}>Sign Up</Text>
                </TouchableOpacity>
              </View>

              {/* Inputs */}
              <InputField
                label="Email Address"
                placeholder="name@example.com"
                placeholderTextColor="#666"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={handleEmailChange}
                error={emailError}
                labelStyle={{ color: "#888" }}
                style={{
                  backgroundColor: "transparent",
                  borderWidth: 0,
                  borderBottomWidth: 1,
                  borderBottomColor: "#475569",
                  borderRadius: 0,
                  color: "#FFFFFF",
                  paddingHorizontal: 0,
                  paddingVertical: 12,
                }}
              />

              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 14, color: "#888", marginBottom: 6, fontWeight: "600" }}>
                  Password
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <TextInput
                    placeholder="Enter your password"
                    placeholderTextColor="#666"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={handlePasswordChange}
                    style={{
                      flex: 1,
                      backgroundColor: "transparent",
                      borderWidth: 0,
                      borderBottomWidth: 1,
                      borderBottomColor: passwordError ? "#C1121F" : "#475569",
                      borderRadius: 0,
                      color: "#FFFFFF",
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
                      color="#888"
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
                <Text style={{ fontSize: 13, fontWeight: "500", color: "#888" }}>
                  Forgot Password?
                </Text>
              </TouchableOpacity>

              <Button
                title="Sign In"
                onPress={handleLogin}
                loading={isLoading}
                textStyle={{ color: "#151515" }}
                style={{
                  borderRadius: 999,
                  height: 52,
                  backgroundColor: "#FFFFFF",
                }}
              />
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
