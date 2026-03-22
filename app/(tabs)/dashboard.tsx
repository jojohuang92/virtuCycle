import { Radii, Spacing } from "@/constants/Colors";
import { FontFamily, TypeScale } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useSession } from "@/hooks/useSession";
import { getFriendsLeaderboard } from "@/services/supabase";
import type { LeaderboardEntry } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const RECENT_ITEMS = [
  {
    id: "1",
    icon: "water-outline" as const,
    name: "PET Water Bottle",
    time: "2 hours ago",
    points: 5,
  },
  {
    id: "2",
    icon: "newspaper-outline" as const,
    name: "Cardboard Box",
    time: "yesterday",
    points: 12,
  },
];

export default function DashboardScreen() {
  const colors = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { profile, user } = useSession();
  const firstName = profile?.displayName?.split(" ")[0] ?? null;
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadLeaderboard() {
      try {
        setLeaderboardLoading(true);
        const nextLeaderboard = await getFriendsLeaderboard(user, profile);

        if (active) {
          setLeaderboard(nextLeaderboard);
        }
      } finally {
        if (active) {
          setLeaderboardLoading(false);
        }
      }
    }

    void loadLeaderboard();

    return () => {
      active = false;
    };
  }, [user?.id, profile?.id, profile?.scansThisMonth, profile?.displayName]);

  const currentUserRank =
    leaderboard.find((entry) => entry.isCurrentUser)?.rank ?? leaderboard.length;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={20} color={colors.primary} />
          </View>
          <Text style={styles.appName}>VirtuCycle</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.iconBtn}
            accessibilityLabel="Accessibility mode"
          >
            <Ionicons
              name="accessibility-outline"
              size={22}
              color={colors.primary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            accessibilityLabel="Notifications"
          >
            <Ionicons
              name="notifications-outline"
              size={22}
              color={colors.primary}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
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
        <TouchableOpacity activeOpacity={0.88} style={styles.scanWrapper}>
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
                <View style={styles.percentBadge}>
                  <Text style={styles.percentBadgeText}>+12%</Text>
                </View>
              </View>
              <Text style={styles.statNumber}>
                {profile?.scansThisMonth ?? 342}
              </Text>
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
                #{currentUserRank || 1}
              </Text>
              <Text style={[styles.statLabel, styles.greenLabelText]}>
                FRIEND RANK
              </Text>
            </View>
          </View>

          {/* Quick Tip (Implement Gemini AI to provide personalized tips)*/}
          <View style={styles.tipCard}>
            <Ionicons name="bulb-outline" size={22} color={colors.primary} />
            <Text style={styles.tipText}>
              "Clean plastic containers before scanning to ensure they can be
              recycled effectively."
            </Text>
          </View>
        </View>

        {/* Trash Recycled */}
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
                      <Text style={styles.leaderboardRankText}>#{entry.rank}</Text>
                    </View>
                    <View style={styles.leaderboardInfo}>
                      <Text style={styles.archiveName}>
                        {entry.displayName}
                        {entry.isCurrentUser ? " (You)" : ""}
                      </Text>
                      <Text style={styles.archiveMeta}>
                        {entry.scansThisMonth} items recycled this month
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
            <Text style={styles.archiveTitle}> Trash Recycled </Text>
            <TouchableOpacity>
              <Text style={styles.viewAll}>View All</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.archiveList}>
            {RECENT_ITEMS.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.archiveItem}
                activeOpacity={0.7}
              >
                <View style={styles.archiveIconWrap}>
                  <Ionicons name={item.icon} size={22} color={colors.primary} />
                </View>
                <View style={styles.archiveInfo}>
                  <Text style={styles.archiveName}>{item.name}</Text>
                  <Text style={styles.archiveMeta}>
                    Scanned {item.time} • +{item.points} Points
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.outline}
                />
              </TouchableOpacity>
            ))}
          </View>
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
  percentBadge: {
    backgroundColor: colors.tertiaryContainer + "44",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
  },
  percentBadgeText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    color: colors.tertiary,
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
});
}
