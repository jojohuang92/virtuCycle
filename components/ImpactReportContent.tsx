import { BIN_CONFIG, type BinType } from "@/constants/bins";
import { Radii, Spacing } from "@/constants/Colors";
import { FontFamily, TypeScale } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useSession } from "@/hooks/useSession";
import { getRecycledHistory } from "@/services/supabase";
import type { RecycledItemRecord, ScanResult } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";

type BreakdownRow = {
  key: string;
  label: string;
  count: number;
  share: number;
  icon: string;
  color: string;
};

type ImpactReportContentProps = {
  contentContainerStyle?: StyleProp<ViewStyle>;
};

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function buildBinBreakdown(history: RecycledItemRecord[]): BreakdownRow[] {
  const total = history.length || 1;

  return (Object.keys(BIN_CONFIG) as BinType[])
    .map((binType) => {
      const count = history.filter((item) => item.binType === binType).length;
      return {
        key: binType,
        label: BIN_CONFIG[binType].label,
        count,
        share: count / total,
        icon: BIN_CONFIG[binType].icon,
        color: BIN_CONFIG[binType].color,
      };
    })
    .filter((entry) => entry.count > 0)
    .sort((left, right) => right.count - left.count);
}

function buildSourceBreakdown(history: RecycledItemRecord[]): BreakdownRow[] {
  const labels: Record<ScanResult["source"], string> = {
    mlkit: "ML Kit",
    gemini: "Gemini",
    claude: "Claude",
    fallback: "Fallback",
  };
  const colors = {
    mlkit: "#2f855a",
    gemini: "#b7791f",
    claude: "#1f4c8f",
    fallback: "#6b7280",
  } as const;
  const icons = {
    mlkit: "scan-outline",
    gemini: "sparkles-outline",
    claude: "bulb-outline",
    fallback: "help-circle-outline",
  } as const;
  const total = history.length || 1;

  return (Object.keys(labels) as Array<ScanResult["source"]>)
    .map((source) => {
      const count = history.filter((item) => item.source === source).length;
      return {
        key: source,
        label: labels[source],
        count,
        share: count / total,
        icon: icons[source],
        color: colors[source],
      };
    })
    .filter((entry) => entry.count > 0)
    .sort((left, right) => right.count - left.count);
}

export default function ImpactReportContent({
  contentContainerStyle,
}: ImpactReportContentProps) {
  const colors = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { profile, user } = useSession();
  const [refreshing, setRefreshing] = useState(false);
  const [history, setHistory] = useState<RecycledItemRecord[]>([]);

  const loadHistory = useCallback(async () => {
    const nextHistory = await getRecycledHistory(user?.id);
    setHistory(nextHistory);
  }, [user?.id]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadHistory();
    } finally {
      setRefreshing(false);
    }
  }, [loadHistory]);

  const monthStart = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  }, []);

  const monthlyHistory = useMemo(
    () => history.filter((item) => item.recycledAt >= monthStart),
    [history, monthStart],
  );

  const monthlyItemCount = Math.max(
    profile?.scansThisMonth ?? 0,
    monthlyHistory.length,
  );
  const monthlyCo2 = Math.max(
    profile?.co2SavedKg ?? 0,
    Number(
      monthlyHistory
        .reduce((sum, item) => sum + item.impactCo2Kg, 0)
        .toFixed(2),
    ),
  );
  const totalItems = history.length;
  const totalPoints = history.reduce((sum, item) => sum + item.impactPoints, 0);
  const totalCo2 = Number(
    history.reduce((sum, item) => sum + item.impactCo2Kg, 0).toFixed(2),
  );
  const hazardousCount = history.filter(
    (item) => item.binType === "hazardous",
  ).length;
  const binBreakdown = buildBinBreakdown(history);
  const topBin = binBreakdown[0];
  const sourceBreakdown = buildSourceBreakdown(history);
  const recentItems = history.slice(0, 5);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
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
        <Text style={styles.heroEyebrow}>FULL REPORT</Text>
        <Text style={styles.heroTitle}>Your recycling footprint at a glance.</Text>
        <Text style={styles.heroSubtitle}>
          Track monthly momentum, all-time savings, and the kinds of items you recycle most.
        </Text>
      </View>

      <View style={styles.metricsGrid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>This Month</Text>
          <Text style={styles.metricValue}>{monthlyItemCount}</Text>
          <Text style={styles.metricSubtext}>items confirmed recycled</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Monthly CO2 Saved</Text>
          <Text style={styles.metricValue}>{monthlyCo2.toFixed(2)} kg</Text>
          <Text style={styles.metricSubtext}>current month profile impact</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>All-Time Points</Text>
          <Text style={styles.metricValue}>+{totalPoints}</Text>
          <Text style={styles.metricSubtext}>from recorded recycled items</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Hazardous Items</Text>
          <Text style={styles.metricValue}>{hazardousCount}</Text>
          <Text style={styles.metricSubtext}>handled with special disposal</Text>
        </View>
      </View>

      <View style={styles.summaryCardRow}>
        <View style={styles.summaryCardLarge}>
          <Text style={styles.sectionTitle}>Top Disposal Stream</Text>
          <Text style={styles.summaryHeadline}>{topBin?.label ?? "No data yet"}</Text>
          <Text style={styles.summaryCopy}>
            {topBin
              ? `${topBin.count} items, ${Math.round(topBin.share * 100)}% of all confirmed recyclables.`
              : "Confirm a few recycled items to unlock your breakdown."}
          </Text>
        </View>
        <View style={styles.summaryCardSmall}>
          <Text style={styles.sectionTitle}>All-Time CO2</Text>
          <Text style={styles.summaryNumber}>{totalCo2.toFixed(2)} kg</Text>
          <Text style={styles.summaryCopy}>across {totalItems} recorded items</Text>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Bin Breakdown</Text>
        {binBreakdown.length === 0 ? (
          <Text style={styles.emptyText}>No recycled items available for a report yet.</Text>
        ) : (
          binBreakdown.map((entry) => (
            <View key={entry.key} style={styles.breakdownRow}>
              <View style={styles.breakdownLeft}>
                <View
                  style={[
                    styles.breakdownIconWrap,
                    { backgroundColor: entry.color },
                  ]}
                >
                  <Ionicons name={entry.icon as any} size={18} color="#ffffff" />
                </View>
                <View>
                  <Text style={styles.breakdownLabel}>{entry.label}</Text>
                  <Text style={styles.breakdownMeta}>{entry.count} items</Text>
                </View>
              </View>
              <Text style={styles.breakdownShare}>{Math.round(entry.share * 100)}%</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Detection Sources</Text>
        {sourceBreakdown.length === 0 ? (
          <Text style={styles.emptyText}>Source performance will appear after more confirmed scans.</Text>
        ) : (
          sourceBreakdown.map((entry) => (
            <View key={entry.key} style={styles.breakdownRow}>
              <View style={styles.breakdownLeft}>
                <View
                  style={[
                    styles.breakdownIconWrap,
                    { backgroundColor: entry.color },
                  ]}
                >
                  <Ionicons name={entry.icon as any} size={18} color="#ffffff" />
                </View>
                <View>
                  <Text style={styles.breakdownLabel}>{entry.label}</Text>
                  <Text style={styles.breakdownMeta}>{entry.count} confirmed items</Text>
                </View>
              </View>
              <Text style={styles.breakdownShare}>{Math.round(entry.share * 100)}%</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {recentItems.length === 0 ? (
          <Text style={styles.emptyText}>No report activity yet.</Text>
        ) : (
          recentItems.map((item) => (
            <View key={item.id} style={styles.activityRow}>
              <View style={styles.activityLeft}>
                <View
                  style={[
                    styles.activityIconWrap,
                    { backgroundColor: BIN_CONFIG[item.binType].accent },
                  ]}
                >
                  <Ionicons
                    name={BIN_CONFIG[item.binType].icon as any}
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.activityTextBlock}>
                  <Text style={styles.activityTitle}>{item.item}</Text>
                  <Text style={styles.activityMeta}>
                    {BIN_CONFIG[item.binType].label} • {formatDate(item.recycledAt)}
                  </Text>
                </View>
              </View>
              <Text style={styles.activityPoints}>+{item.impactPoints}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    scroll: { flex: 1 },
    scrollContent: {
      padding: Spacing.lg,
      gap: Spacing.lg,
      paddingBottom: Spacing.xxxl,
    },
    heroCard: {
      backgroundColor: colors.surfaceContainerHighest,
      borderRadius: Radii.xl,
      padding: Spacing.xl,
      gap: Spacing.sm,
    },
    heroEyebrow: {
      fontFamily: FontFamily.bodySemiBold,
      fontSize: TypeScale.bodySm,
      letterSpacing: 1.2,
      color: colors.textMuted,
    },
    heroTitle: {
      fontFamily: FontFamily.displayBold,
      fontSize: TypeScale.headlineMd,
      color: colors.primary,
      lineHeight: 36,
    },
    heroSubtitle: {
      fontFamily: FontFamily.body,
      fontSize: TypeScale.bodyMd,
      color: colors.textMuted,
      lineHeight: 22,
    },
    metricsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: Spacing.md,
    },
    metricCard: {
      width: "47%",
      backgroundColor: colors.surfaceContainerHigh,
      borderRadius: Radii.lg,
      padding: Spacing.lg,
      gap: Spacing.xs,
    },
    metricLabel: {
      fontFamily: FontFamily.bodySemiBold,
      fontSize: TypeScale.bodySm,
      color: colors.textMuted,
    },
    metricValue: {
      fontFamily: FontFamily.displayBold,
      fontSize: TypeScale.titleLg,
      color: colors.primary,
    },
    metricSubtext: {
      fontFamily: FontFamily.body,
      fontSize: TypeScale.bodySm,
      color: colors.textMuted,
      lineHeight: 18,
    },
    summaryCardRow: {
      flexDirection: "row",
      gap: Spacing.md,
    },
    summaryCardLarge: {
      flex: 1.2,
      backgroundColor: colors.surfaceContainerHigh,
      borderRadius: Radii.lg,
      padding: Spacing.lg,
      gap: Spacing.sm,
    },
    summaryCardSmall: {
      flex: 0.8,
      backgroundColor: colors.surfaceContainerHigh,
      borderRadius: Radii.lg,
      padding: Spacing.lg,
      gap: Spacing.sm,
    },
    sectionCard: {
      backgroundColor: colors.surfaceContainerHighest,
      borderRadius: Radii.xl,
      padding: Spacing.xl,
      gap: Spacing.md,
    },
    sectionTitle: {
      fontFamily: FontFamily.displayBold,
      fontSize: TypeScale.titleMd,
      color: colors.primary,
    },
    summaryHeadline: {
      fontFamily: FontFamily.displayBold,
      fontSize: TypeScale.titleLg,
      color: colors.text,
    },
    summaryNumber: {
      fontFamily: FontFamily.displayBold,
      fontSize: TypeScale.headlineSm,
      color: colors.primary,
    },
    summaryCopy: {
      fontFamily: FontFamily.body,
      fontSize: TypeScale.bodyMd,
      color: colors.textMuted,
      lineHeight: 22,
    },
    breakdownRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: Spacing.sm,
    },
    breakdownLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.md,
      flex: 1,
    },
    breakdownIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
    },
    breakdownLabel: {
      fontFamily: FontFamily.bodySemiBold,
      fontSize: TypeScale.bodyMd,
      color: colors.text,
    },
    breakdownMeta: {
      fontFamily: FontFamily.body,
      fontSize: TypeScale.bodySm,
      color: colors.textMuted,
    },
    breakdownShare: {
      fontFamily: FontFamily.displayBold,
      fontSize: TypeScale.bodyMd,
      color: colors.primary,
    },
    activityRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: Spacing.sm,
      gap: Spacing.md,
    },
    activityLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.md,
      flex: 1,
    },
    activityIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: "center",
      justifyContent: "center",
    },
    activityTextBlock: {
      flex: 1,
      gap: 2,
    },
    activityTitle: {
      fontFamily: FontFamily.bodySemiBold,
      fontSize: TypeScale.bodyMd,
      color: colors.text,
    },
    activityMeta: {
      fontFamily: FontFamily.body,
      fontSize: TypeScale.bodySm,
      color: colors.textMuted,
    },
    activityPoints: {
      fontFamily: FontFamily.displayBold,
      fontSize: TypeScale.bodyMd,
      color: colors.primary,
    },
    emptyText: {
      fontFamily: FontFamily.body,
      fontSize: TypeScale.bodyMd,
      color: colors.textMuted,
      lineHeight: 22,
    },
  });
}