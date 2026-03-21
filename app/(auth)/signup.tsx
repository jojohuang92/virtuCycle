import { Colors, Radii, Spacing } from "@/constants/Colors";
import { FontFamily, TypeScale } from "@/constants/typography";
import { signUpWithEmail, storeDemoSession } from "@/services/supabase";
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

export default function SignupScreen() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  async function handleSignUp() {
    if (!displayName.trim() || !email.trim() || !password.trim()) {
      Alert.alert("Missing fields", "Please fill in all fields.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Weak password", "Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await signUpWithEmail(
        email.trim(),
        password,
        displayName.trim(),
      );
      if (error) {
        if (error.message.includes("environment variables")) {
          await storeDemoSession(email.trim());
          router.replace("/(tabs)/dashboard");
        } else {
          Alert.alert("Sign up failed", error.message);
        }
      } else {
        Alert.alert(
          "Check your email",
          "We sent a confirmation link to " +
            email.trim() +
            ". Click it to activate your account.",
          [{ text: "OK", onPress: () => router.replace("/(auth)/login") }],
        );
      }
    } catch (err: any) {
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
        <Link href="/(auth)/login" asChild>
          <Pressable>
            <Text style={styles.signInLink}>SIGN IN</Text>
          </Pressable>
        </Link>
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
            <View style={styles.cardHeader}>
              <Text style={styles.title}>Join the Collective</Text>
              <Text style={styles.subtitle}>
                Start your sustainable journey today.
              </Text>
            </View>

            {/* Display name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Your Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Jane Smith"
                placeholderTextColor={Colors.outline + "80"}
                value={displayName}
                onChangeText={setDisplayName}
                autoCapitalize="words"
                autoComplete="name"
                returnKeyType="next"
                accessibilityLabel="Your name"
              />
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
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="Min. 6 characters"
                  placeholderTextColor={Colors.outline + "80"}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!passwordVisible}
                  autoComplete="new-password"
                  returnKeyType="done"
                  onSubmitEditing={handleSignUp}
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

            {/* Create account button */}
            <Pressable
              style={({ pressed }) => [
                styles.submitBtn,
                pressed && styles.btnPressed,
              ]}
              onPress={handleSignUp}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Create your account"
            >
              <LinearGradient
                colors={[Colors.primary, Colors.primaryContainer]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitGradient}
              >
                {loading ? (
                  <ActivityIndicator color={Colors.onPrimary} />
                ) : (
                  <Text style={styles.submitText}>Create Account</Text>
                )}
              </LinearGradient>
            </Pressable>

            {/* Sign in link */}
            <View style={styles.loginRow}>
              <Text style={styles.loginText}>Already a member?</Text>
              <Link href="/(auth)/login" asChild>
                <Pressable>
                  <Text style={styles.loginLink}> Sign In</Text>
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
  signInLink: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: TypeScale.label,
    color: Colors.primary + "B3",
    letterSpacing: 2,
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
  title: {
    fontFamily: FontFamily.displayBold,
    fontSize: TypeScale.headlineMd,
    color: Colors.primary,
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  subtitle: {
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
  submitBtn: {
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
  submitGradient: {
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: {
    fontFamily: FontFamily.displayBold,
    fontSize: TypeScale.bodyLg,
    color: Colors.onPrimary,
    letterSpacing: 0.2,
  },
  termsNotice: {
    fontFamily: FontFamily.body,
    fontSize: TypeScale.label,
    color: Colors.textMuted,
    textAlign: "center",
    marginTop: Spacing.md,
    lineHeight: 18,
  },
  termsLink: {
    color: Colors.primary,
    fontFamily: FontFamily.bodySemiBold,
  },
  loginRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: Spacing.lg,
  },
  loginText: {
    fontFamily: FontFamily.body,
    fontSize: TypeScale.bodySm,
    color: Colors.textMuted,
  },
  loginLink: {
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
