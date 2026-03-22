import { Radii, Spacing } from "@/constants/Colors";
import { FontFamily, TypeScale } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useSession } from "@/hooks/useSession";
import { getQuickTipsHistory } from "@/services/supabase";
import type { QuickTipRecord } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function formatRelativeTime(timestamp: number) {
  const elapsed = Date.now() - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (elapsed < minute) {
    return "just now";
  }

  if (elapsed < hour) {
    const minutes = Math.max(1, Math.floor(elapsed / minute));
    return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  }

  if (elapsed < day) {
    const hours = Math.max(1, Math.floor(elapsed / hour));
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  const days = Math.max(1, Math.floor(elapsed / day));
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export default function QuickTipsScreen() {
  const colors = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useSession();
  const [refreshing, setRefreshing] = useState(false);
  const [history, setHistory] = useState<QuickTipRecord[]>([]);

  const loadHistory = useCallback(async () => {
    const nextHistory = await getQuickTipsHistory(user?.id);
    setHistory(nextHistory);
  }, [user?.id]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);

    try {
      await loadHistory();
    } finally {
      setRefreshing(false);
    }
  }, [loadHistory]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => router.back()}
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Quick Tips</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void handleRefresh();
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Quick Tip History</Text>
          <Text style={styles.heroSubtitle}>
            Every generated dashboard tip is saved here for later reference.
          </Text>
        </View>

        <View style={styles.tipList}>
          {history.length === 0 ? (
            <View style={styles.tipCard}>
              <View style={styles.tipIconWrap}>
                <Ionicons
                  name="bulb-outline"
                  size={22}
                  color={colors.primary}
                />
              </View>
              <View style={styles.tipInfo}>
                <Text style={styles.tipText}>No quick tips yet</Text>
                <Text style={styles.tipMeta}>
                  Open the dashboard to generate your first tip.
                </Text>
              </View>
            </View>
          ) : (
            history.map((tip) => (
              <View key={tip.id} style={styles.tipCard}>
                <View style={styles.tipIconWrap}>
                  <Ionicons
                    name="bulb-outline"
                    size={22}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.tipInfo}>
                  <Text style={styles.tipText}>{tip.text}</Text>
                  <Text style={styles.tipMeta}>
                    {formatRelativeTime(tip.createdAt)} • {tip.city}
                    {tip.state ? `, ${tip.state}` : ""} • {tip.source}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
    },
    headerTitle: {
      fontFamily: FontFamily.displayBold,
      fontSize: TypeScale.titleLg,
      color: colors.primary,
      letterSpacing: -0.3,
    },
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.xxl,
    },
    heroCard: {
      backgroundColor: colors.surfaceContainerHighest,
      borderRadius: Radii.lg,
      padding: Spacing.xl,
      marginTop: Spacing.md,
      marginBottom: Spacing.xl,
      gap: Spacing.xs,
    },
    heroTitle: {
      fontFamily: FontFamily.displayBold,
      fontSize: TypeScale.headlineMd,
      color: colors.primary,
      letterSpacing: -0.5,
    },
    heroSubtitle: {
      fontFamily: FontFamily.body,
      fontSize: TypeScale.bodyMd,
      color: colors.textMuted,
      lineHeight: 22,
    },
    tipList: {
      gap: Spacing.sm,
    },
    tipCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.md,
      padding: Spacing.md,
      backgroundColor: colors.surfaceContainerLow,
      borderRadius: Radii.md,
    },
    tipIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.surfaceContainerHigh,
      alignItems: "center",
      justifyContent: "center",
    },
    tipInfo: {
      flex: 1,
      gap: 4,
    },
    tipText: {
      fontFamily: FontFamily.bodyBold,
      fontSize: TypeScale.bodyMd,
      color: colors.primary,
      lineHeight: 22,
    },
    tipMeta: {
      fontFamily: FontFamily.body,
      fontSize: TypeScale.label,
      color: colors.textMuted,
    },
  });
}
