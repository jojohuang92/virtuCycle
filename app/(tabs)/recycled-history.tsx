import { BIN_CONFIG } from "@/constants/bins";
import { Radii, Spacing } from "@/constants/Colors";
import { FontFamily, TypeScale } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useSession } from "@/hooks/useSession";
import { getRecycledHistory } from "@/services/supabase";
import type { RecycledItemRecord } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Modal,
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

function formatDateTime(timestamp: number) {
  return new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildHistoryMeta(record: RecycledItemRecord) {
  const binLabel = BIN_CONFIG[record.binType].label;
  const pointsLabel = `+${record.impactPoints} pts`;

  return `${formatRelativeTime(record.recycledAt)} • ${binLabel} • ${pointsLabel}`;
}

export default function RecycledHistoryScreen() {
  const colors = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useSession();
  const [refreshing, setRefreshing] = useState(false);
  const [history, setHistory] = useState<RecycledItemRecord[]>([]);
  const [selectedHistoryItem, setSelectedHistoryItem] =
    useState<RecycledItemRecord | null>(null);

  const loadHistory = useCallback(async () => {
    const nextHistory = await getRecycledHistory(user?.id);
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
        <Text style={styles.headerTitle}>Recent Recycled</Text>
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
          <Text style={styles.heroTitle}>All Recycled Items</Text>
          <Text style={styles.heroSubtitle}>
            Browse every confirmed recycled item and open any record for full
            details.
          </Text>
        </View>

        <View style={styles.archiveList}>
          {history.length === 0 ? (
            <View style={styles.archiveItem}>
              <View style={styles.archiveIconWrap}>
                <Ionicons
                  name="time-outline"
                  size={22}
                  color={colors.primary}
                />
              </View>
              <View style={styles.archiveInfo}>
                <Text style={styles.archiveName}>No recycled items yet</Text>
                <Text style={styles.archiveMeta}>
                  Confirm a scanned item to build your recycle history.
                </Text>
              </View>
            </View>
          ) : (
            history.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.archiveItem}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`View details for ${item.item}`}
                onPress={() => setSelectedHistoryItem(item)}
              >
                <View style={styles.archiveIconWrap}>
                  <Ionicons
                    name={BIN_CONFIG[item.binType].icon as any}
                    size={22}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.archiveInfo}>
                  <Text style={styles.archiveName}>{item.item}</Text>
                  <Text style={styles.archiveMeta}>
                    {buildHistoryMeta(item)}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.outline}
                />
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      <Modal
        visible={Boolean(selectedHistoryItem)}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedHistoryItem(null)}
      >
        <View style={styles.detailOverlay}>
          <View style={styles.detailSheet}>
            <View style={styles.detailHandle} />
            <View style={styles.detailHeader}>
              <View style={styles.detailTitleBlock}>
                <Text style={styles.detailEyebrow}>Recycled Item</Text>
                <Text style={styles.detailTitle}>
                  {selectedHistoryItem?.item ?? ""}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.detailCloseBtn}
                onPress={() => setSelectedHistoryItem(null)}
                accessibilityLabel="Close recycled item details"
              >
                <Ionicons name="close" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>

            {selectedHistoryItem ? (
              <>
                <View style={styles.detailHeroRow}>
                  <View style={styles.detailIconWrap}>
                    <Ionicons
                      name={BIN_CONFIG[selectedHistoryItem.binType].icon as any}
                      size={28}
                      color={colors.primary}
                    />
                  </View>
                  <View style={styles.detailHeroInfo}>
                    <Text style={styles.detailTargetLabel}>Recycle Target</Text>
                    <Text style={styles.detailTargetValue}>
                      {BIN_CONFIG[selectedHistoryItem.binType].label}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailCard}>
                  <Text style={styles.detailCardTitle}>Guidance</Text>
                  <Text style={styles.detailBodyText}>
                    {selectedHistoryItem.explanation ||
                      "No additional guidance was saved for this item."}
                  </Text>
                </View>

                <View style={styles.detailGrid}>
                  <View style={styles.detailStatCard}>
                    <Text style={styles.detailStatLabel}>Recycled</Text>
                    <Text style={styles.detailStatValue}>
                      {formatDateTime(selectedHistoryItem.recycledAt)}
                    </Text>
                  </View>
                  <View style={styles.detailStatCard}>
                    <Text style={styles.detailStatLabel}>Scanned</Text>
                    <Text style={styles.detailStatValue}>
                      {formatDateTime(selectedHistoryItem.scannedAt)}
                    </Text>
                  </View>
                  <View style={styles.detailStatCard}>
                    <Text style={styles.detailStatLabel}>Source</Text>
                    <Text style={styles.detailStatValue}>
                      {selectedHistoryItem.source.toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.detailStatCard}>
                    <Text style={styles.detailStatLabel}>Confidence</Text>
                    <Text style={styles.detailStatValue}>
                      {Math.round(selectedHistoryItem.confidence * 100)}%
                    </Text>
                  </View>
                </View>

                <View style={styles.detailImpactRow}>
                  <View style={styles.detailImpactCard}>
                    <Text style={styles.detailImpactLabel}>Impact Points</Text>
                    <Text style={styles.detailImpactValue}>
                      +{selectedHistoryItem.impactPoints}
                    </Text>
                  </View>
                  <View style={styles.detailImpactCard}>
                    <Text style={styles.detailImpactLabel}>CO2 Saved</Text>
                    <Text style={styles.detailImpactValue}>
                      {selectedHistoryItem.impactCo2Kg.toFixed(2)} kg
                    </Text>
                  </View>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
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
    archiveList: {
      gap: Spacing.sm,
    },
    archiveItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.md,
      padding: Spacing.md,
      backgroundColor: colors.surfaceContainerLow,
      borderRadius: Radii.md,
    },
    archiveIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.surfaceContainerHigh,
      alignItems: "center",
      justifyContent: "center",
    },
    archiveInfo: {
      flex: 1,
    },
    archiveName: {
      fontFamily: FontFamily.bodyBold,
      fontSize: TypeScale.bodyMd,
      color: colors.primary,
      marginBottom: 2,
    },
    archiveMeta: {
      fontFamily: FontFamily.body,
      fontSize: TypeScale.label,
      color: colors.textMuted,
    },
    detailOverlay: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: colors.overlay,
    },
    detailSheet: {
      backgroundColor: colors.surfaceContainerLowest,
      borderTopLeftRadius: Radii.lg,
      borderTopRightRadius: Radii.lg,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.xl,
      gap: Spacing.md,
    },
    detailHandle: {
      alignSelf: "center",
      width: 56,
      height: 6,
      borderRadius: Radii.full,
      backgroundColor: colors.outlineVariant,
      marginBottom: Spacing.xs,
    },
    detailHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: Spacing.md,
    },
    detailTitleBlock: {
      flex: 1,
    },
    detailEyebrow: {
      fontFamily: FontFamily.bodySemiBold,
      fontSize: TypeScale.label,
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 1.2,
      marginBottom: 4,
    },
    detailTitle: {
      fontFamily: FontFamily.displayBold,
      fontSize: TypeScale.headlineMd,
      color: colors.primary,
      letterSpacing: -0.5,
    },
    detailCloseBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceContainerHigh,
    },
    detailHeroRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.md,
      backgroundColor: colors.surfaceContainerLow,
      borderRadius: Radii.md,
      padding: Spacing.md,
    },
    detailIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceContainerHigh,
    },
    detailHeroInfo: {
      flex: 1,
      gap: 2,
    },
    detailTargetLabel: {
      fontFamily: FontFamily.bodySemiBold,
      fontSize: TypeScale.label,
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    detailTargetValue: {
      fontFamily: FontFamily.displayBold,
      fontSize: TypeScale.titleLg,
      color: colors.primary,
    },
    detailCard: {
      backgroundColor: colors.surfaceContainerLow,
      borderRadius: Radii.md,
      padding: Spacing.md,
      gap: Spacing.xs,
    },
    detailCardTitle: {
      fontFamily: FontFamily.bodyBold,
      fontSize: TypeScale.bodyMd,
      color: colors.primary,
    },
    detailBodyText: {
      fontFamily: FontFamily.body,
      fontSize: TypeScale.bodyMd,
      color: colors.textMuted,
      lineHeight: 22,
    },
    detailGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: Spacing.sm,
    },
    detailStatCard: {
      width: "48%",
      backgroundColor: colors.surfaceContainerLow,
      borderRadius: Radii.md,
      padding: Spacing.md,
      gap: 6,
    },
    detailStatLabel: {
      fontFamily: FontFamily.bodySemiBold,
      fontSize: TypeScale.label,
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    detailStatValue: {
      fontFamily: FontFamily.bodyBold,
      fontSize: TypeScale.bodyMd,
      color: colors.primary,
    },
    detailImpactRow: {
      flexDirection: "row",
      gap: Spacing.sm,
    },
    detailImpactCard: {
      flex: 1,
      backgroundColor: colors.secondaryContainer,
      borderRadius: Radii.md,
      padding: Spacing.md,
      gap: 6,
    },
    detailImpactLabel: {
      fontFamily: FontFamily.bodySemiBold,
      fontSize: TypeScale.label,
      color: colors.onSecondaryContainer,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    detailImpactValue: {
      fontFamily: FontFamily.displayBold,
      fontSize: TypeScale.titleLg,
      color: colors.onSecondaryContainer,
    },
  });
}
