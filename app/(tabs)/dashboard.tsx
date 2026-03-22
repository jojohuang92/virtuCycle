import { BIN_CONFIG } from "@/constants/bins";
import { Radii, Spacing } from "@/constants/Colors";
import { FontFamily, TypeScale } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useSession } from "@/hooks/useSession";
import { generateQuickTip, getRecyclingRules } from "@/services/gemini";
import { getUserLocation } from "@/services/location";
import {
  getFriendsLeaderboard,
  getQuickTipsHistory,
  getRecycledHistory,
  storeQuickTip,
} from "@/services/supabase";
import type {
  LeaderboardEntry,
  QuickTipRecord,
  RecycledItemRecord,
} from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
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

function buildHistoryMeta(record: RecycledItemRecord) {
  const binLabel = BIN_CONFIG[record.binType].label;
  const pointsLabel = `+${record.impactPoints} pts`;

  return `${formatRelativeTime(record.recycledAt)} • ${binLabel} • ${pointsLabel}`;
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

export default function DashboardScreen() {
  const colors = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { profile, refreshProfile, user, ttsEnabled, toggleTTS } = useSession();
  const firstName = profile?.displayName?.split(" ")[0] ?? null;
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recycledHistory, setRecycledHistory] = useState<RecycledItemRecord[]>(
    [],
  );
  const [currentQuickTip, setCurrentQuickTip] = useState<QuickTipRecord | null>(
    null,
  );
  const [quickTipLoading, setQuickTipLoading] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] =
    useState<RecycledItemRecord | null>(null);

  const loadLeaderboard = useCallback(async () => {
    setLeaderboardLoading(true);
    try {
      const nextLeaderboard = await getFriendsLeaderboard(user, profile);
      setLeaderboard(nextLeaderboard);
    } finally {
      setLeaderboardLoading(false);
    }
  }, [profile, user]);

  const loadRecycledHistory = useCallback(async () => {
    const history = await getRecycledHistory(user?.id);
    setRecycledHistory(history.slice(0, 3));
  }, [user?.id]);

  const loadQuickTipHistory = useCallback(async () => {
    const history = await getQuickTipsHistory(user?.id);
    setCurrentQuickTip(history[0] ?? null);
  }, [user?.id]);

  const refreshQuickTip = useCallback(async () => {
    setQuickTipLoading(true);

    try {
      const location = await getUserLocation();
      const city = location?.city || "General";
      const state = location?.state || "";
      const rules = await getRecyclingRules(city, state);
      const recentItems = (await getRecycledHistory(user?.id))
        .slice(0, 3)
        .map((item) => item.item);
      const generatedTip = await generateQuickTip(
        city,
        state,
        rules,
        recentItems,
      );
      const storedTip = await storeQuickTip(generatedTip, user?.id);
      setCurrentQuickTip(storedTip);
    } catch (error) {
      console.warn("Quick tip refresh failed:", error);
      await loadQuickTipHistory();
    } finally {
      setQuickTipLoading(false);
    }
  }, [loadQuickTipHistory, user?.id]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);

    try {
      await Promise.all([
        refreshProfile(),
        loadLeaderboard(),
        loadRecycledHistory(),
        refreshQuickTip(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [loadLeaderboard, loadRecycledHistory, refreshProfile, refreshQuickTip]);

  useEffect(() => {
    let active = true;

    void loadLeaderboard().catch(() => {
      if (active) {
        setLeaderboardLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [
    loadLeaderboard,
    user?.id,
    profile?.id,
    profile?.scansThisMonth,
    profile?.displayName,
  ]);

  useEffect(() => {
    let active = true;

    void loadRecycledHistory().catch(() => {
      if (active) {
        setRecycledHistory([]);
      }
    });

    return () => {
      active = false;
    };
  }, [loadRecycledHistory, user?.id, profile?.scansThisMonth]);

  useEffect(() => {
    let active = true;

    void loadQuickTipHistory().catch(() => {
      if (active) {
        setCurrentQuickTip(null);
      }
    });

    return () => {
      active = false;
    };
  }, [loadQuickTipHistory, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void refreshQuickTip();
    }, [refreshQuickTip]),
  );

  const currentUserRank =
    leaderboard.find((entry) => entry.isCurrentUser)?.rank ??
    leaderboard.length;
  const currentUserEntry =
    leaderboard.find((entry) => entry.isCurrentUser) ?? null;
  const currentUserScanTotal =
    currentUserEntry?.scansThisMonth ?? profile?.scansThisMonth ?? 0;
  const leaderboardSize = Math.max(
    leaderboard.length,
    currentUserEntry ? 1 : 0,
  );
  const leaderScanCount = leaderboard[0]?.scansThisMonth ?? 0;
  const currentUserScanCount = currentUserEntry?.scansThisMonth ?? 0;
  const scanGap = Math.max(0, leaderScanCount - currentUserScanCount);
  const rankingPrimaryText = leaderboardLoading
    ? "..."
    : `#${Math.max(currentUserRank || 1, 1)}`;
  const rankingLabel = leaderboardLoading
    ? "UPDATING RANK"
    : leaderboardSize <= 1
      ? "NO FRIENDS YET"
      : `${leaderboardSize} IN STANDINGS`;
  const rankingMeta = leaderboardLoading
    ? "Refreshing leaderboard"
    : leaderboardSize <= 1
      ? "Add friends to compare scan totals"
      : currentUserRank === 1
        ? "You are leading this month"
        : `${scanGap} scan${scanGap === 1 ? "" : "s"} behind #1`;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatar}>
            {profile?.avatarUrl ? (
              <Image
                source={{ uri: profile.avatarUrl }}
                style={styles.avatarImage}
              />
            ) : (
              <Ionicons name="person" size={20} color={colors.primary} />
            )}
          </View>
          <Text style={styles.appName}>VirtuCycle</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.iconBtn, ttsEnabled && styles.iconBtnActive]}
            accessibilityLabel={
              ttsEnabled
                ? "Mute voice announcements"
                : "Enable voice announcements"
            }
            onPress={toggleTTS}
          >
            <Ionicons
              name={ttsEnabled ? "volume-high-outline" : "volume-mute-outline"}
              size={22}
              color={ttsEnabled ? colors.onPrimary : colors.primary}
            />
          </TouchableOpacity>
        </View>
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
        {/* Welcome */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeTitle}>
            Welcome back{firstName ? `, ${firstName}` : ""}!
          </Text>
          <Text style={styles.welcomeSubtitle}>
            Ready to make an impact today?
          </Text>
        </View>

        {/* Scan CTA */}
        <TouchableOpacity
          activeOpacity={0.88}
          style={styles.scanWrapper}
          accessibilityRole="button"
          accessibilityLabel="Start a new scan"
          onPress={() => router.push("/(tabs)/scanner")}
        >
          <LinearGradient
            colors={[colors.primary, colors.primaryContainer]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.scanButton}
          >
            <Ionicons name="scan-outline" size={40} color={colors.onPrimary} />
            <Text style={styles.scanText}> New Scan</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          {/* Impact Petal — full width */}
          <View style={styles.impactPetal}>
            <Ionicons
              name="leaf"
              size={40}
              color="#ffffff"
              style={styles.impactIcon}
            />
            <Text style={styles.impactNumber}>
              {profile?.co2SavedKg?.toFixed(1) ?? "12.4"}
            </Text>
            <Text style={styles.impactLabel}>KG CO₂ SAVED</Text>
            <View style={styles.impactBadge}>
              <Text style={styles.impactBadgeText}>Top 5% this month</Text>
            </View>
          </View>

          {/* Stat row */}
          <View style={styles.statRow}>
            {/* Items Scanned */}
            <View style={[styles.statCard, styles.statCardLight]}>
              <View style={styles.statCardTop}>
                <Ionicons
                  name="barcode-outline"
                  size={28}
                  color={colors.primary}
                />
              </View>
              <Text style={styles.statNumber}>{currentUserScanTotal}</Text>
              <Text style={styles.statLabel}>Items Scanned</Text>
            </View>

            {/* Friend Ranking */}
            <View style={[styles.statCard, styles.statCardGreen]}>
              <View style={styles.creditIconWrap}>
                <Ionicons
                  name="trophy-outline"
                  size={28}
                  color={colors.onSecondaryContainer}
                />
              </View>
              <Text style={[styles.statNumber, styles.greenText]}>
                {rankingPrimaryText}
              </Text>
              <Text style={[styles.statLabel, styles.greenLabelText]}>
                {rankingLabel}
              </Text>
              <Text style={styles.greenMetaText}>{rankingMeta}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.tipCard}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Open quick tips history"
            onPress={() => router.push("/(tabs)/quick-tips")}
          >
            <Ionicons name="bulb-outline" size={22} color={colors.primary} />
            <Text style={styles.tipText}>
              {quickTipLoading
                ? "Generating a fresh tip..."
                : currentQuickTip?.text ||
                  "Pull to refresh for a fresh recycling tip."}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Recent Recycled */}
        <View style={styles.archiveSection}>
          <View style={styles.leaderboardSection}>
            <View style={styles.archiveHeader}>
              <Text style={styles.archiveTitle}>Friends Leaderboard</Text>
            </View>

            {leaderboardLoading ? (
              <View style={styles.leaderboardLoading}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.archiveMeta}>Loading standings...</Text>
              </View>
            ) : (
              <View style={styles.leaderboardList}>
                {leaderboard.map((entry) => (
                  <View
                    key={entry.id}
                    style={[
                      styles.leaderboardRow,
                      entry.isCurrentUser && styles.leaderboardRowCurrent,
                    ]}
                  >
                    <View style={styles.leaderboardRank}>
                      <Text style={styles.leaderboardRankText}>
                        #{entry.rank}
                      </Text>
                    </View>
                    <View style={styles.leaderboardInfo}>
                      <Text style={styles.archiveName}>
                        {entry.displayName}
                        {entry.isCurrentUser ? " (You)" : ""}
                      </Text>
                      <Text style={styles.archiveMeta}>
                        {entry.scansThisMonth} scan
                        {entry.scansThisMonth === 1 ? "" : "s"} this month
                      </Text>
                    </View>
                    <Text style={styles.leaderboardPoints}>
                      {entry.scansThisMonth}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.archiveHeader}>
            <Text style={styles.archiveTitle}> Recent Recycled </Text>
            <TouchableOpacity
              disabled={recycledHistory.length === 0}
              onPress={() => router.push("/(tabs)/recycled-history")}
            >
              <Text style={styles.viewAll}>View All</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.archiveList}>
            {recycledHistory.length === 0 ? (
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
                    Confirm a scanned item to start building your report
                    history.
                  </Text>
                </View>
              </View>
            ) : (
              recycledHistory.map((item) => (
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

    // ── Header ──────────────────────────────────────────────
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      backgroundColor: colors.background + "CC",
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
      flex: 1,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primaryContainer + "55",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    avatarImage: {
      width: 40,
      height: 40,
      borderRadius: 20,
    },
    appName: {
      fontFamily: FontFamily.displayBold,
      fontSize: TypeScale.titleLg,
      color: colors.primary,
      letterSpacing: -0.5,
    },
    headerRight: {
      flexDirection: "row",
      gap: 4,
    },
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    iconBtnActive: {
      backgroundColor: colors.primary,
    },

    // ── Scroll ───────────────────────────────────────────────
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.xxl,
    },

    // ── Welcome ──────────────────────────────────────────────
    welcomeSection: {
      marginTop: Spacing.md,
      marginBottom: Spacing.xl,
    },
    welcomeTitle: {
      fontFamily: FontFamily.displayBold,
      fontSize: TypeScale.headlineLg,
      color: colors.primary,
      letterSpacing: -0.5,
      marginBottom: 4,
    },
    welcomeSubtitle: {
      fontFamily: FontFamily.body,
      fontSize: TypeScale.bodyMd,
      color: colors.textMuted,
    },

    // ── Scan CTA ─────────────────────────────────────────────
    scanWrapper: {
      marginBottom: Spacing.xl,
      borderRadius: Radii.lg,
      overflow: "hidden",
    },
    scanButton: {
      paddingVertical: 40,
      alignItems: "center",
      justifyContent: "center",
      gap: Spacing.sm,
    },
    scanText: {
      fontFamily: FontFamily.displayBold,
      fontSize: TypeScale.titleLg,
      color: colors.onPrimary,
    },

    // ── Stats Grid ───────────────────────────────────────────
    statsGrid: {
      gap: Spacing.md,
      marginBottom: Spacing.xl,
    },

    // Impact Petal
    impactPetal: {
      backgroundColor: colors.tertiaryContainer,
      borderRadius: Radii.lg,
      paddingVertical: Spacing.xxl,
      alignItems: "center",
      justifyContent: "center",
    },
    impactIcon: {
      marginBottom: Spacing.md,
    },
    impactNumber: {
      fontFamily: FontFamily.displayBold,
      fontSize: 56,
      color: "#ffffff",
      lineHeight: 60,
      letterSpacing: -1,
    },
    impactLabel: {
      fontFamily: FontFamily.bodySemiBold,
      fontSize: TypeScale.label,
      color: "#ffffff",
      opacity: 0.8,
      letterSpacing: 2,
      marginTop: 4,
    },
    impactBadge: {
      marginTop: Spacing.lg,
      backgroundColor: "rgba(0,0,0,0.15)",
      paddingHorizontal: Spacing.md,
      paddingVertical: 6,
      borderRadius: Radii.full,
    },
    impactBadgeText: {
      fontFamily: FontFamily.bodyBold,
      fontSize: TypeScale.label,
      color: "#ffffff",
    },

    // Stat Row
    statRow: {
      flexDirection: "row",
      gap: Spacing.md,
    },
    statCard: {
      flex: 1,
      borderRadius: Radii.lg,
      padding: Spacing.lg,
      minHeight: 148,
      justifyContent: "space-between",
    },
    statCardLight: {
      backgroundColor: colors.surfaceContainerLow,
    },
    statCardGreen: {
      backgroundColor: colors.secondaryContainer,
    },
    statCardTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    creditIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.onSecondaryContainer + "18",
      alignItems: "center",
      justifyContent: "center",
    },
    statNumber: {
      fontFamily: FontFamily.displayBold,
      fontSize: TypeScale.headlineMd,
      color: colors.primary,
      letterSpacing: -0.5,
    },
    statLabel: {
      fontFamily: FontFamily.bodySemiBold,
      fontSize: TypeScale.label,
      color: colors.textMuted,
      letterSpacing: 0.5,
    },
    greenText: {
      color: colors.onSecondaryContainer,
    },
    greenLabelText: {
      color: colors.onSecondaryContainer,
      opacity: 0.7,
      letterSpacing: 0.5,
    },
    greenMetaText: {
      fontFamily: FontFamily.body,
      fontSize: TypeScale.label,
      color: colors.onSecondaryContainer,
      opacity: 0.7,
      lineHeight: 18,
    },

    // Quick Tip
    tipCard: {
      backgroundColor: colors.surfaceContainerHighest,
      borderRadius: Radii.lg,
      padding: Spacing.lg,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: Spacing.md,
    },
    tipText: {
      fontFamily: FontFamily.bodyMedium,
      fontSize: TypeScale.bodySm,
      color: colors.primary,
      lineHeight: 20,
      flex: 1,
      fontStyle: "italic",
    },

    // ── Recent Archive ────────────────────────────────────────
    archiveSection: {},
    leaderboardSection: {
      marginBottom: Spacing.xl,
    },
    leaderboardLoading: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
      backgroundColor: colors.surfaceContainerLow,
      borderRadius: Radii.md,
      padding: Spacing.md,
    },
    leaderboardList: {
      gap: Spacing.sm,
    },
    leaderboardRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.md,
      padding: Spacing.md,
      borderRadius: Radii.md,
      backgroundColor: colors.surfaceContainerLow,
    },
    leaderboardRowCurrent: {
      backgroundColor: colors.secondaryContainer,
    },
    leaderboardRank: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.surfaceContainerHighest,
      alignItems: "center",
      justifyContent: "center",
    },
    leaderboardRankText: {
      fontFamily: FontFamily.displayBold,
      fontSize: TypeScale.bodyMd,
      color: colors.primary,
    },
    leaderboardInfo: {
      flex: 1,
    },
    leaderboardPoints: {
      fontFamily: FontFamily.displayBold,
      fontSize: TypeScale.titleMd,
      color: colors.primary,
    },
    archiveHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: Spacing.lg,
    },
    archiveTitle: {
      fontFamily: FontFamily.displayBold,
      fontSize: TypeScale.titleLg,
      color: colors.primary,
      letterSpacing: -0.3,
    },
    viewAll: {
      fontFamily: FontFamily.bodyBold,
      fontSize: TypeScale.bodySm,
      color: colors.primary,
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
