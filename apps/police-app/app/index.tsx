import React, { useState, useEffect } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { authStyles as s } from "./styles/Auth.styles";

export default function SignInScreen() {
  const router = useRouter();
  const { signIn, user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace("/(tabs)/dashboard");
    }
  }, [user, isLoading]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      setError("Please enter email and password.");
      return;
    }
    setError("");
    try {
      setSubmitting(true);
      await signIn(email.trim(), password);
      router.replace("/(tabs)/dashboard");
    } catch (err: any) {
      setError(err.message || "Invalid email or password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#001A4D" />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.logoSection}>
          <Image
            source={require("../assets/logo-police.png")}
            style={s.logoImage}
            resizeMode="contain"
          />
          <View style={s.appNameRow}>
            <Text style={s.appNameLigtas}>LIGTAS</Text>
            <Text style={s.appNameCalbayog}> CALBAYOG</Text>
          </View>
          <Text style={s.appSub}>Police Operations Portal</Text>
        </View>

        <View style={s.form}>
          <View>
            <Text style={s.label}>Email</Text>
            <TextInput
              style={s.input}
              placeholder="Enter your email"
              placeholderTextColor="rgba(245,247,250,0.3)"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View>
            <Text style={s.label}>Password</Text>
            <View style={s.inputPasswordWrap}>
              <TextInput
                style={[s.input, s.inputPassword]}
                placeholder="Enter your password"
                placeholderTextColor="rgba(245,247,250,0.3)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                style={s.passwordToggle}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={showPassword ? "eye-off" : "eye"}
                  size={20}
                  color="rgba(245,247,250,0.4)"
                />
              </TouchableOpacity>
            </View>
          </View>

          {error ? <Text style={s.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[s.actionBtn, submitting && s.actionBtnDisabled]}
            onPress={handleSignIn}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#F5F7FA" />
            ) : (
              <Text style={s.actionBtnText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <View style={s.linkRow}>
            <Text style={s.linkText}>Don't have an account?</Text>
            <TouchableOpacity onPress={() => router.push("/signup")}>
              <Text style={s.linkAction}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
