import { AccessibilityColors, Radii, Spacing } from "@/constants/Colors";
import { FontFamily, TypeScale } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useSession } from "@/hooks/useSession";
import type { AccessibilityMode } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
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
    ...AccessibilityColors.default,
  },
  protanopia: {
    label: "Protanopia",
    ...AccessibilityColors.protanopia,
  },
  deuteranopia: {
    label: "Deuteranopia",
    ...AccessibilityColors.deuteranopia,
  },
  tritanopia: {
    label: "Tritanopia",
    ...AccessibilityColors.tritanopia,
  },
};

type AccessibilityTheme =
  (typeof ACCESSIBILITY_MODES)[keyof typeof ACCESSIBILITY_MODES];
type SettingsTheme = Omit<AccessibilityTheme, "label">;

export default function SettingsScreen() {
  const colors = useAppTheme();
  const { profile, saveProfile } = useSession();

  const [username, setUsername] = useState(profile?.displayName ?? "");
  const [savedUsername, setSavedUsername] = useState(profile?.displayName ?? "");
  const [colorMode, setColorMode] =
    useState<AccessibilityMode>(
      profile?.accessibilityMode ?? "default",
    );
  const [isSavingName, setIsSavingName] = useState(false);
  const [isSavingAccessibility, setIsSavingAccessibility] = useState(false);

  useEffect(() => {
    setUsername(profile?.displayName ?? "");
    setSavedUsername(profile?.displayName ?? "");
    setColorMode(profile?.accessibilityMode ?? "default");
  }, [profile?.displayName, profile?.accessibilityMode]);

  const theme = ACCESSIBILITY_MODES[colorMode];
  const pageTheme: SettingsTheme =
    colorMode === (profile?.accessibilityMode ?? "default")
    ? colors
    : theme;
  const styles = useMemo(() => createStyles(pageTheme), [pageTheme]);

  async function handleSaveName() {
    const trimmedName = username.trim();

    if (!trimmedName) {
      Alert.alert("Invalid username", "Please enter a username first.");
      return;
    }

    try {
      setIsSavingName(true);
      await saveProfile({ displayName: trimmedName });
      setSavedUsername(trimmedName);
      Alert.alert(
        "Saved",
        `Your username has been updated to "${trimmedName}".`,
      );
    } catch (error) {
      Alert.alert("Unable to save", "We couldn't update your username.");
    } finally {
      setIsSavingName(false);
    }
  }

  async function handleSaveAccessibility() {
    try {
      setIsSavingAccessibility(true);
      await saveProfile({ accessibilityMode: colorMode });
      Alert.alert(
        "Accessibility updated",
        `Color mode set to ${ACCESSIBILITY_MODES[colorMode].label}.`,
      );
    } catch (error) {
      Alert.alert(
        "Unable to save",
        "We couldn't update your accessibility settings.",
      );
    } finally {
      setIsSavingAccessibility(false);
    }
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

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleSaveName}
            disabled={isSavingName}
          >
            <Text style={styles.primaryButtonText}>
              {isSavingName ? "Saving..." : "Save Username"}
            </Text>
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
            disabled={isSavingAccessibility}
          >
            <Text style={styles.primaryButtonText}>
              {isSavingAccessibility ? "Saving..." : "Save Accessibility"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(theme: SettingsTheme) {
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
