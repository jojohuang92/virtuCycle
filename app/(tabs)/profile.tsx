import { Colors, Radii, Spacing } from "@/constants/Colors";
import { FontFamily, TypeScale } from "@/constants/typography";
import { useSession } from "@/hooks/useSession";
import { signOut } from "@/services/supabase";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const CURATOR_LINKS = [
  {
    id: "reports",
    icon: "bar-chart-outline" as const,
    label: "Impact Reports",
    sublabel: "Detailed breakdown of your footprint",
  },
  {
    id: "settings",
    icon: "settings-outline" as const,
    label: "Account Settings",
    sublabel: "Privacy, notifications, and security",
  },
];

export default function ProfileScreen() {
  const { profile, loading } = useSession();

  async function handleSignOut() {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/(auth)/login");
        },
      },
    ]);
  }

  const joinedYear = profile?.joinedAt
    ? new Date(profile.joinedAt).getFullYear()
    : null;

  const [firstName, ...rest] = (profile?.displayName ?? "").split(" ");
  const lastName = rest.join(" ");

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={22} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          {/* Avatar */}
          <View style={styles.avatarWrapper}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={72} color={Colors.primary} />
            </View>
            {/* Level badge */}
            <View style={styles.levelBadge}>
              <Ionicons name="leaf" size={14} color="#ffffff" />
              <Text style={styles.levelText}>
                Level {profile?.level ?? 1}
              </Text>
            </View>
          </View>

          {/* Name & metadata */}
          <View style={styles.nameBlock}>
            {loading ? (
              <View style={styles.namePlaceholder} />
            ) : (
              <>
                <Text style={styles.firstName}>{firstName || "—"}</Text>
                {lastName ? (
                  <Text style={styles.lastName}>{lastName}</Text>
                ) : null}
              </>
            )}
            <View style={styles.memberRow}>
              <View style={styles.memberDot} />
              <Text style={styles.memberText}>
                {joinedYear ? `Member since ${joinedYear}` : "New member"}
              </Text>
            </View>
          </View>
        </View>

        {/* Impact Card */}
        <View style={styles.impactCard}>
          <View style={styles.impactCardTop}>
            <Ionicons name="sparkles" size={32} color={Colors.primary} />
            <TouchableOpacity style={styles.reportBtn}>
              <Text style={styles.reportBtnText}>View Full Report</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.impactStat}>
            {profile?.scansThisMonth ?? 342} Items Recycled
          </Text>
          <Text style={styles.impactSubtext}>
            You've diverted {profile?.co2SavedKg?.toFixed(1) ?? "12.4"}kg of
            waste this month.
          </Text>
        </View>

        {/* Curator Dashboard */}
        <View style={styles.curatorSection}>
          <Text style={styles.curatorTitle}>Curator Dashboard</Text>
          <View style={styles.curatorList}>
            {CURATOR_LINKS.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.curatorItem}
                activeOpacity={0.7}
              >
                <View style={styles.curatorItemLeft}>
                  <View style={styles.curatorIconWrap}>
                    <Ionicons
                      name={item.icon}
                      size={22}
                      color={Colors.primary}
                    />
                  </View>
                  <View>
                    <Text style={styles.curatorLabel}>{item.label}</Text>
                    <Text style={styles.curatorSublabel}>{item.sublabel}</Text>
                  </View>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={Colors.outline}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // ── Header ───────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: TypeScale.titleLg,
    color: Colors.primaryContainer,
    letterSpacing: -0.3,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Scroll ───────────────────────────────────────────────
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },

  // ── Hero ─────────────────────────────────────────────────
  heroSection: {
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl,
    gap: Spacing.xl,
  },
  avatarWrapper: {
    position: "relative",
    alignSelf: "flex-start",
  },
  avatar: {
    width: 160,
    height: 160,
    borderRadius: Radii.lg,
    backgroundColor: Colors.surfaceContainerHighest,
    alignItems: "center",
    justifyContent: "center",
  },
  levelBadge: {
    position: "absolute",
    bottom: -14,
    right: -14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.tertiaryContainer,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radii.full,
    shadowColor: Colors.primary,
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  levelText: {
    fontFamily: FontFamily.displayBold,
    fontSize: TypeScale.bodySm,
    color: "#ffffff",
  },
  nameBlock: {
    gap: 4,
    marginTop: Spacing.sm,
  },
  namePlaceholder: {
    height: 52,
    width: 180,
    borderRadius: Radii.sm,
    backgroundColor: Colors.surfaceContainerHigh,
  },
  firstName: {
    fontFamily: FontFamily.displayBold,
    fontSize: 45,
    color: Colors.primary,
    lineHeight: 56,
    letterSpacing: -2,
  },
  lastName: {
    fontFamily: FontFamily.displayBold,
    fontSize: 45,
    color: Colors.primary,
    lineHeight: 56,
    letterSpacing: -2,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  memberDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.tertiary,
  },
  memberText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: TypeScale.bodyMd,
    color: Colors.textMuted,
  },

  // ── Impact Card ──────────────────────────────────────────
  impactCard: {
    backgroundColor: Colors.surfaceContainerHighest,
    borderRadius: Radii.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.xxl,
    gap: Spacing.sm,
  },
  impactCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  reportBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderRadius: Radii.full,
  },
  reportBtnText: {
    fontFamily: FontFamily.displayBold,
    fontSize: TypeScale.bodySm,
    color: Colors.onPrimary,
  },
  impactStat: {
    fontFamily: FontFamily.displayBold,
    fontSize: TypeScale.headlineMd,
    color: Colors.primary,
    letterSpacing: -0.5,
  },
  impactSubtext: {
    fontFamily: FontFamily.body,
    fontSize: TypeScale.bodyMd,
    color: Colors.textMuted,
    lineHeight: 22,
  },

  // ── Curator Dashboard ────────────────────────────────────
  curatorSection: {
    gap: Spacing.lg,
  },
  curatorTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: TypeScale.titleMd,
    color: Colors.primary,
  },
  curatorList: {
    gap: Spacing.md,
  },
  curatorItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radii.md,
  },
  curatorItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
    flex: 1,
  },
  curatorIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surfaceContainerHighest,
    alignItems: "center",
    justifyContent: "center",
  },
  curatorLabel: {
    fontFamily: FontFamily.displayBold,
    fontSize: TypeScale.bodyLg,
    color: Colors.text,
    marginBottom: 2,
  },
  curatorSublabel: {
    fontFamily: FontFamily.body,
    fontSize: TypeScale.bodySm,
    color: Colors.textMuted,
  },
});
