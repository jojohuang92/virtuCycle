import { Colors, Radii, Spacing } from "@/constants/Colors";
import { FontFamily, TypeScale } from "@/constants/typography";
import { signInWithEmail, storeDemoSession } from "@/services/supabase";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Link, router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  async function handleSignIn() {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Missing fields", "Please enter your email and password.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await signInWithEmail(email.trim(), password);
      if (error) {
        // If Supabase isn't configured, fall back to demo mode
        if (error.message.includes("environment variables")) {
          await storeDemoSession(email.trim());
          router.replace("/(tabs)/dashboard");
        } else {
          Alert.alert("Sign in failed", error.message);
        }
      } else {
        router.replace("/(tabs)/dashboard");
      }
    } catch (err: any) {
      // Demo mode fallback when Supabase is not configured
      if (err?.message?.includes("environment variables")) {
        await storeDemoSession(email.trim());
        router.replace("/(tabs)/dashboard");
      } else {
        Alert.alert("Error", "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.brand}>
          <Ionicons name="leaf" size={28} color={Colors.primary} />
          <Text style={styles.brandName}>VirtuCycle</Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.ttsControl,
            pressed && styles.ttsControlPressed,
          ]}
          onPress={() => {}}
          accessibilityRole="button"
          accessibilityLabel="Open accessibility mode"
        >
          <View style={styles.ttsIconWrap}>
            <Ionicons name="accessibility" size={20} color={Colors.primary} />
          </View>
          <Text style={styles.ttsLabel}>{"ACCESSIBILITY\nMODE"}</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Card */}
          <View style={styles.card}>
            {/* Welcome copy */}
            <View style={styles.cardHeader}>
              <Text style={styles.welcomeTitle}>Welcome Back</Text>
              <Text style={styles.welcomeSubtitle}>
                Access your sustainable dashboard.
              </Text>
            </View>

            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                placeholder="name@domain.com"
                placeholderTextColor={Colors.outline + "80"}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                returnKeyType="next"
                accessibilityLabel="Email address"
              />
            </View>

            {/* Password */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Password</Text>
                <Pressable>
                  <Text style={styles.forgotLink}>FORGOT?</Text>
                </Pressable>
              </View>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="••••••••"
                  placeholderTextColor={Colors.outline + "80"}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!passwordVisible}
                  autoComplete="password"
                  returnKeyType="done"
                  onSubmitEditing={handleSignIn}
                  accessibilityLabel="Password"
                />
                <Pressable
                  style={styles.eyeButton}
                  onPress={() => setPasswordVisible((v) => !v)}
                  accessibilityLabel={
                    passwordVisible ? "Hide password" : "Show password"
                  }
                >
                  <Ionicons
                    name={passwordVisible ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={Colors.outline}
                  />
                </Pressable>
              </View>
            </View>

            {/* Sign In button */}
            <Pressable
              style={({ pressed }) => [
                styles.signInBtn,
                pressed && styles.btnPressed,
              ]}
              onPress={handleSignIn}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Sign in"
            >
              <LinearGradient
                colors={[Colors.primary, Colors.primaryContainer]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.signInGradient}
              >
                {loading ? (
                  <ActivityIndicator color={Colors.onPrimary} />
                ) : (
                  <Text style={styles.signInText}>Sign In</Text>
                )}
              </LinearGradient>
            </Pressable>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerLabel}>OR CONTINUE WITH</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* SSO buttons */}
            <View style={styles.ssoRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.ssoBtn,
                  pressed && styles.ssoBtnPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Continue with Google"
              >
                <Ionicons name="logo-google" size={18} color={Colors.text} />
                <Text style={styles.ssoBtnText}>Google</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.ssoBtn,
                  pressed && styles.ssoBtnPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Continue with Apple"
              >
                <Ionicons name="logo-apple" size={18} color={Colors.text} />
                <Text style={styles.ssoBtnText}>Apple</Text>
              </Pressable>
            </View>

            {/* Accessibility Mode*/}
            <View style={styles.joinRow}>
              <Text style={styles.joinText}>New to the collective?</Text>
              <Link href="/(auth)/signup" asChild>
                <Pressable>
                  <Text style={styles.joinLink}> Join VirtuCycle</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background + "CC",
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brandName: {
    fontFamily: FontFamily.displayBold,
    fontSize: TypeScale.titleLg,
    color: Colors.primary,
    letterSpacing: -0.5,
  },
  signUpLink: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: TypeScale.label,
    color: Colors.primary + "B3",
    letterSpacing: 2,
  },
  ttsControl: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radii.full,
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    shadowColor: Colors.primary,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  ttsControlPressed: {
    opacity: 0.9,
  },
  ttsIconWrap: {
    width: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  ttsLabel: {
    fontFamily: FontFamily.displayBold,
    fontSize: TypeScale.label,
    color: Colors.primary,
    textAlign: "center",
    letterSpacing: 1.1,
    lineHeight: 16,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxl,
    justifyContent: "center",
  },
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radii.lg,
    padding: Spacing.xl,
    shadowColor: Colors.primary,
    shadowOpacity: 0.06,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 20 },
    elevation: 6,
    borderWidth: 1,
    borderColor: Colors.outlineVariant + "1A",
  },
  cardHeader: {
    marginBottom: Spacing.xl,
  },
  welcomeTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: TypeScale.headlineMd,
    color: Colors.primary,
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  welcomeSubtitle: {
    fontFamily: FontFamily.body,
    fontSize: TypeScale.bodyMd,
    color: Colors.textMuted,
  },
  fieldGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: TypeScale.bodySm,
    color: Colors.textMuted,
    marginBottom: 8,
    marginLeft: 4,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    marginLeft: 4,
  },
  forgotLink: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: TypeScale.label,
    color: Colors.primary + "B3",
    letterSpacing: 1,
  },
  input: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    fontFamily: FontFamily.body,
    fontSize: TypeScale.bodyMd,
    color: Colors.text,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  passwordContainer: {
    position: "relative",
  },
  passwordInput: {
    paddingRight: 48,
  },
  eyeButton: {
    position: "absolute",
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  signInBtn: {
    marginTop: Spacing.sm,
    borderRadius: Radii.full,
    overflow: "hidden",
    shadowColor: Colors.primary,
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  btnPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  signInGradient: {
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  signInText: {
    fontFamily: FontFamily.displayBold,
    fontSize: TypeScale.bodyLg,
    color: Colors.onPrimary,
    letterSpacing: 0.2,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.outlineVariant + "4D",
  },
  dividerLabel: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 10,
    color: Colors.outline,
    letterSpacing: 2,
  },
  ssoRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  ssoBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radii.full,
    paddingVertical: 14,
  },
  ssoBtnPressed: {
    backgroundColor: Colors.surfaceContainerHigh,
  },
  ssoBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: TypeScale.bodySm,
    color: Colors.text,
  },
  joinRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: Spacing.xl,
  },
  joinText: {
    fontFamily: FontFamily.body,
    fontSize: TypeScale.bodySm,
    color: Colors.textMuted,
  },
  joinLink: {
    fontFamily: FontFamily.bodyBold,
    fontSize: TypeScale.bodySm,
    color: Colors.primary,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.lg,
    marginTop: Spacing.xl,
  },
  footerLink: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 10,
    color: Colors.outline,
    letterSpacing: 1.5,
  },
});
