import { Colors, Radii, Spacing } from "@/constants/Colors";
import { FontFamily, TypeScale } from "@/constants/typography";
import { useSession } from "@/hooks/useSession";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const ACCESSIBILITY_MODES = {
  default: {
    label: "Default",
    primary: Colors.primary,
    primaryContainer: Colors.primaryContainer,
    tertiary: Colors.tertiary,
    tertiaryContainer: Colors.tertiaryContainer,
    background: Colors.background,
    surfaceContainerHighest: Colors.surfaceContainerHighest,
    surfaceContainerHigh: Colors.surfaceContainerHigh,
    surfaceContainerLow: Colors.surfaceContainerLow,
    outline: Colors.outline,
    text: Colors.text,
    textMuted: Colors.textMuted,
    onPrimary: Colors.onPrimary,
  },
  protanopia: {
    label: "Protanopia",
    primary: "#2F6FED",
    primaryContainer: "#2A4D80",
    tertiary: "#6C8F76",
    tertiaryContainer: "#7EA488",
    background: Colors.background,
    surfaceContainerHighest: "#EAF0F7",
    surfaceContainerHigh: "#DFE8F2",
    surfaceContainerLow: "#F6F9FC",
    outline: "#9AA8B8",
    text: "#1C2430",
    textMuted: "#627080",
    onPrimary: "#FFFFFF",
  },
  deuteranopia: {
    label: "Deuteranopia",
    primary: "#3A66CC",
    primaryContainer: "#304E8C",
    tertiary: "#B38457",
    tertiaryContainer: "#C79869",
    background: Colors.background,
    surfaceContainerHighest: "#ECECF4",
    surfaceContainerHigh: "#E2E4EE",
    surfaceContainerLow: "#F8F9FC",
    outline: "#A5ADC0",
    text: "#202532",
    textMuted: "#687081",
    onPrimary: "#FFFFFF",
  },
  tritanopia: {
    label: "Tritanopia",
    primary: "#C96D35",
    primaryContainer: "#8A4D27",
    tertiary: "#5D8F66",
    tertiaryContainer: "#71A47A",
    background: Colors.background,
    surfaceContainerHighest: "#F7EEE8",
    surfaceContainerHigh: "#F1E5DD",
    surfaceContainerLow: "#FCF8F5",
    outline: "#BFA89A",
    text: "#2B221D",
    textMuted: "#78685E",
    onPrimary: "#FFFFFF",
  },
};

export default function SettingsScreen() {
  const { profile } = useSession();

  const [username, setUsername] = useState(profile?.displayName ?? "");
  const [savedUsername, setSavedUsername] = useState(profile?.displayName ?? "");
  const [colorMode, setColorMode] =
    useState<keyof typeof ACCESSIBILITY_MODES>("default");

  const theme = ACCESSIBILITY_MODES[colorMode];
  const styles = useMemo(() => createStyles(theme), [theme]);

  function handleSaveName() {
    const trimmedName = username.trim();

    if (!trimmedName) {
      Alert.alert("Invalid username", "Please enter a username first.");
      return;
    }

    setSavedUsername(trimmedName);
    Alert.alert("Saved", `Your username has been updated to "${trimmedName}".`);
  }

  function handleSaveAccessibility() {
    Alert.alert(
      "Accessibility updated",
      `Color mode set to ${ACCESSIBILITY_MODES[colorMode].label}.`
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={theme.primary} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Settings</Text>

        <View style={styles.backBtnPlaceholder} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.previewCard}>
          <Text style={styles.previewEyebrow}>PROFILE PREVIEW</Text>
          <Text style={styles.previewName}>{savedUsername || "Unnamed User"}</Text>
          <Text style={styles.previewSubtext}>
            Personalize your account and accessibility settings.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Change Username</Text>
          <Text style={styles.sectionSubtext}>
            Update the display name shown on your profile.
          </Text>

          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="Enter your username"
            placeholderTextColor={theme.textMuted}
            style={styles.input}
          />

          <TouchableOpacity style={styles.primaryButton} onPress={handleSaveName}>
            <Text style={styles.primaryButtonText}>Save Username</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Color Blind Options</Text>
          <Text style={styles.sectionSubtext}>
            Choose a color mode that works better for your vision while keeping
            the same overall design style.
          </Text>

          <View style={styles.optionGroup}>
            {(Object.keys(ACCESSIBILITY_MODES) as Array<
              keyof typeof ACCESSIBILITY_MODES
            >).map((modeKey) => {
              const active = colorMode === modeKey;

              return (
                <TouchableOpacity
                  key={modeKey}
                  style={[styles.optionButton, active && styles.optionButtonActive]}
                  onPress={() => setColorMode(modeKey)}
                >
                  <View style={styles.optionLeft}>
                    <View
                      style={[
                        styles.swatch,
                        { backgroundColor: ACCESSIBILITY_MODES[modeKey].primary },
                      ]}
                    />
                    <Text
                      style={[
                        styles.optionText,
                        active && styles.optionTextActive,
                      ]}
                    >
                      {ACCESSIBILITY_MODES[modeKey].label}
                    </Text>
                  </View>

                  {active ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={theme.onPrimary}
                    />
                  ) : (
                    <Ionicons
                      name="ellipse-outline"
                      size={20}
                      color={theme.outline}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleSaveAccessibility}
          >
            <Text style={styles.primaryButtonText}>Save Accessibility</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(theme: (typeof ACCESSIBILITY_MODES)["default"]) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: theme.background,
    },

    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    backBtnPlaceholder: {
      width: 40,
      height: 40,
    },
    headerTitle: {
      fontFamily: FontFamily.displayBold,
      fontSize: TypeScale.titleLg,
      color: theme.primaryContainer,
      letterSpacing: -0.3,
    },

    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.xxl,
      gap: Spacing.xl,
    },

    previewCard: {
      backgroundColor: theme.surfaceContainerHighest,
      borderRadius: Radii.lg,
      padding: Spacing.xl,
      gap: Spacing.sm,
      marginTop: Spacing.md,
    },
    previewEyebrow: {
      fontFamily: FontFamily.displayBold,
      fontSize: TypeScale.bodySm,
      color: theme.textMuted,
      letterSpacing: 1,
    },
    previewName: {
      fontFamily: FontFamily.displayBold,
      fontSize: TypeScale.headlineMd,
      color: theme.primary,
      letterSpacing: -0.5,
    },
    previewSubtext: {
      fontFamily: FontFamily.body,
      fontSize: TypeScale.bodyMd,
      color: theme.textMuted,
      lineHeight: 22,
    },

    sectionCard: {
      backgroundColor: theme.surfaceContainerHighest,
      borderRadius: Radii.lg,
      padding: Spacing.xl,
      gap: Spacing.md,
    },
    sectionTitle: {
      fontFamily: FontFamily.displayBold,
      fontSize: TypeScale.titleMd,
      color: theme.primary,
    },
    sectionSubtext: {
      fontFamily: FontFamily.body,
      fontSize: TypeScale.bodyMd,
      color: theme.textMuted,
      lineHeight: 22,
    },

    input: {
      backgroundColor: theme.surfaceContainerLow,
      borderRadius: Radii.md,
      paddingHorizontal: Spacing.lg,
      paddingVertical: 14,
      fontFamily: FontFamily.body,
      fontSize: TypeScale.bodyMd,
      color: theme.text,
      borderWidth: 1,
      borderColor: theme.outline,
    },

    optionGroup: {
      gap: Spacing.sm,
    },
    optionButton: {
      backgroundColor: theme.surfaceContainerLow,
      borderRadius: Radii.md,
      paddingHorizontal: Spacing.lg,
      paddingVertical: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderWidth: 1,
      borderColor: "transparent",
    },
    optionButtonActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    optionLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.md,
    },
    swatch: {
      width: 16,
      height: 16,
      borderRadius: 999,
    },
    optionText: {
      fontFamily: FontFamily.displayBold,
      fontSize: TypeScale.bodyMd,
      color: theme.text,
    },
    optionTextActive: {
      color: theme.onPrimary,
    },

    primaryButton: {
      alignSelf: "flex-start",
      backgroundColor: theme.primary,
      paddingHorizontal: Spacing.lg,
      paddingVertical: 12,
      borderRadius: Radii.full,
      marginTop: Spacing.xs,
    },
    primaryButtonText: {
      fontFamily: FontFamily.displayBold,
      fontSize: TypeScale.bodySm,
      color: theme.onPrimary,
    },
  });
}