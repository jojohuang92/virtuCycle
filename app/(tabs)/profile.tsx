import { Radii, Spacing } from "@/constants/Colors";
import { FontFamily, TypeScale } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useSession } from "@/hooks/useSession";
import {
  getAllUsers,
  getMyFriendRequests,
  respondToFriendRequest,
  sendFriendRequest,
  signOut,
} from "@/services/supabase";
import type { FriendProfile } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const CURATOR_LINKS = [
  {
    id: "friends",
    icon: "people-outline" as const,
    label: "Friends Network",
    sublabel: "Find people, review requests, and grow your crew",
    route: null,
  },
  {
    id: "reports",
    icon: "bar-chart-outline" as const,
    label: "Impact Reports",
    sublabel: "Detailed breakdown of your footprint",
    route: null,
  },
  {
    id: "settings",
    icon: "settings-outline" as const,
    label: "Account Settings",
    sublabel: "Privacy, notifications, accessibility, and profile",
    route: "/settings",
  },
];

export default function ProfileScreen() {
  const colors = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { profile, loading, user } = useSession();
  const [friendsVisible, setFriendsVisible] = useState(false);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendsActionId, setFriendsActionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [allUsers, setAllUsers] = useState<FriendProfile[]>([]);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const [incoming, setIncoming] = useState<{ requestId: string; senderId: string }[]>([]);

  const friends = allUsers.filter((u) => friendIds.has(u.id));
  const incomingProfiles = incoming
    .map((req) => ({ ...req, profile: allUsers.find((u) => u.id === req.senderId) }))
    .filter((r): r is typeof r & { profile: FriendProfile } => Boolean(r.profile));
  const discoverUsers = allUsers.filter(
    (u) =>
      !friendIds.has(u.id) &&
      !incoming.some((r) => r.senderId === u.id) &&
      (searchQuery.trim() === "" ||
        u.displayName.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.trim().toLowerCase())),
  );

  async function loadUsers() {
    try {
      setFriendsLoading(true);
      const [users, requests] = await Promise.all([
        getAllUsers(user),
        getMyFriendRequests(user),
      ]);
      setAllUsers(users);
      setSentIds(requests.sentIds);
      setFriendIds(requests.friendIds);
      setIncoming(requests.incoming);
    } catch (e: any) {
      Alert.alert("Unavailable", e?.message ?? "Could not load users.");
    } finally {
      setFriendsLoading(false);
    }
  }

  useEffect(() => {
    async function loadFriendCount() {
      try {
        const requests = await getMyFriendRequests(user);
        setFriendIds(requests.friendIds);
        setIncoming(requests.incoming);
        setSentIds(requests.sentIds);
      } catch {
        // ignore
      }
    }
    if (user) void loadFriendCount();
  }, [user?.id]);

  useEffect(() => {
    if (friendsVisible) {
      void loadUsers();
    } else {
      setSearchQuery("");
    }
  }, [friendsVisible, user?.id]);

  async function handleRespondToRequest(requestId: string, accept: boolean) {
    try {
      setFriendsActionId(requestId);
      await respondToFriendRequest(user, requestId, accept ? "accepted" : "rejected");
      await loadUsers();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not respond to request.");
    } finally {
      setFriendsActionId(null);
    }
  }

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

  function handleCuratorPress(item: (typeof CURATOR_LINKS)[number]) {
    if (item.id === "friends") {
      setFriendsVisible(true);
      return;
    }

    if (item.route) {
      router.push(item.route as any);
      return;
    }

    Alert.alert("Coming soon", `${item.label} is not connected yet.`);
  }

  const joinedYear = profile?.joinedAt
    ? new Date(profile.joinedAt).getFullYear()
    : null;

  const [firstName, ...rest] = (profile?.displayName ?? "").split(" ");
  const lastName = rest.join(" ");

  async function handleSendFriendRequest(targetUserId: string) {
    try {
      setFriendsActionId(targetUserId);
      await sendFriendRequest(user, targetUserId);
      setSentIds((prev) => new Set(prev).add(targetUserId));
    } catch (error: any) {
      Alert.alert(
        "Request failed",
        error?.message ?? "We couldn't send that friend request.",
      );
    } finally {
      setFriendsActionId(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroSection}>
          <View style={styles.avatarWrapper}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={72} color={colors.primary} />
            </View>

            <View style={styles.levelBadge}>
              <Ionicons name="leaf" size={14} color="#ffffff" />
              <Text style={styles.levelText}>
                Level {profile?.level ?? 1}
              </Text>
            </View>
          </View>

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
              {friendIds.size > 0 && (
                <>
                  <View style={styles.memberDot} />
                  <Text style={styles.memberText}>
                    {friendIds.size} {friendIds.size === 1 ? "Friend" : "Friends"}
                  </Text>
                </>
              )}
            </View>
          </View>
        </View>

        <View style={styles.impactCard}>
          <View style={styles.impactCardTop}>
            <Ionicons name="sparkles" size={32} color={colors.primary} />
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

        <View style={styles.curatorSection}>
          <Text style={styles.curatorTitle}>Curator Dashboard</Text>
          <View style={styles.curatorList}>
            {CURATOR_LINKS.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.curatorItem}
                activeOpacity={0.7}
                onPress={() => handleCuratorPress(item)}
              >
                <View style={styles.curatorItemLeft}>
                  <View style={styles.curatorIconWrap}>
                    <Ionicons
                      name={item.icon}
                      size={22}
                      color={colors.primary}
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
                  color={colors.outline}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={friendsVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setFriendsVisible(false)}
      >
        <SafeAreaView style={styles.modalSafe} edges={["top", "bottom"]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Friends Network</Text>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setFriendsVisible(false)}
            >
              <Ionicons name="close" size={22} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {friendsLoading ? (
            <View style={styles.modalLoadingState}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.modalLoadingText}>Loading people...</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Friends */}
              {friends.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Friends ({friends.length})</Text>
                  {friends.map((person) => (
                    <View key={person.id} style={styles.friendCard}>
                      <View style={styles.friendCardTop}>
                        <View style={styles.friendInfo}>
                          <Text style={styles.friendName}>{person.displayName}</Text>
                          <Text style={styles.friendMeta}>{person.email}</Text>
                        </View>
                        <Text style={styles.friendsBadge}>Friends</Text>
                      </View>
                    </View>
                  ))}
                </>
              )}

              {/* Incoming Requests */}
              {incomingProfiles.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Requests ({incomingProfiles.length})</Text>
                  {incomingProfiles.map(({ requestId, profile }) => (
                    <View key={requestId} style={styles.friendCard}>
                      <View style={styles.friendCardTop}>
                        <View style={styles.friendInfo}>
                          <Text style={styles.friendName}>{profile.displayName}</Text>
                          <Text style={styles.friendMeta}>{profile.email}</Text>
                        </View>
                        <View style={styles.requestActions}>
                          <TouchableOpacity
                            style={styles.acceptButton}
                            disabled={friendsActionId === requestId}
                            onPress={() => handleRespondToRequest(requestId, true)}
                          >
                            <Text style={styles.acceptButtonText}>
                              {friendsActionId === requestId ? "..." : "Accept"}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.rejectButton}
                            disabled={friendsActionId === requestId}
                            onPress={() => handleRespondToRequest(requestId, false)}
                          >
                            <Text style={styles.rejectButtonText}>Decline</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  ))}
                </>
              )}

              {/* Discover */}
              <Text style={styles.sectionTitle}>Discover</Text>
              <View style={styles.searchRow}>
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search by name"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  style={styles.searchInput}
                />
              </View>
              {discoverUsers.length === 0 ? (
                <Text style={styles.emptyStateText}>
                  {searchQuery.trim() ? "No matching users found." : "No other users to discover."}
                </Text>
              ) : (
                discoverUsers.map((person) => (
                  <View key={person.id} style={styles.friendCard}>
                    <View style={styles.friendCardTop}>
                      <View style={styles.friendInfo}>
                        <Text style={styles.friendName}>{person.displayName}</Text>
                        <Text style={styles.friendMeta}>{person.email}</Text>
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.addFriendButton,
                          sentIds.has(person.id) && styles.addFriendButtonSent,
                        ]}
                        disabled={friendsActionId === person.id || sentIds.has(person.id)}
                        onPress={() => handleSendFriendRequest(person.id)}
                      >
                        <Text style={styles.addFriendButtonText}>
                          {friendsActionId === person.id
                            ? "Sending..."
                            : sentIds.has(person.id)
                            ? "Sent"
                            : "Add"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          )}
        </SafeAreaView>
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
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: TypeScale.titleLg,
    color: colors.primaryContainer,
    letterSpacing: -0.3,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },

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
    backgroundColor: colors.surfaceContainerHighest,
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
    backgroundColor: colors.tertiaryContainer,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radii.full,
    shadowColor: colors.primary,
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
    backgroundColor: colors.surfaceContainerHigh,
  },
  firstName: {
    fontFamily: FontFamily.displayBold,
    fontSize: 45,
    color: colors.primary,
    lineHeight: 56,
    letterSpacing: -2,
  },
  lastName: {
    fontFamily: FontFamily.displayBold,
    fontSize: 45,
    color: colors.primary,
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
    backgroundColor: colors.tertiary,
  },
  memberText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: TypeScale.bodyMd,
    color: colors.textMuted,
  },

  impactCard: {
    backgroundColor: colors.surfaceContainerHighest,
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
    backgroundColor: colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderRadius: Radii.full,
  },
  reportBtnText: {
    fontFamily: FontFamily.displayBold,
    fontSize: TypeScale.bodySm,
    color: colors.onPrimary,
  },
  impactStat: {
    fontFamily: FontFamily.displayBold,
    fontSize: TypeScale.headlineMd,
    color: colors.primary,
    letterSpacing: -0.5,
  },
  impactSubtext: {
    fontFamily: FontFamily.body,
    fontSize: TypeScale.bodyMd,
    color: colors.textMuted,
    lineHeight: 22,
  },

  curatorSection: {
    gap: Spacing.lg,
  },
  curatorTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: TypeScale.titleMd,
    color: colors.primary,
  },
  curatorList: {
    gap: Spacing.md,
  },
  curatorItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
    backgroundColor: colors.surfaceContainerLow,
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
    backgroundColor: colors.surfaceContainerHighest,
    alignItems: "center",
    justifyContent: "center",
  },
  curatorLabel: {
    fontFamily: FontFamily.displayBold,
    fontSize: TypeScale.bodyLg,
    color: colors.text,
    marginBottom: 2,
  },
  curatorSublabel: {
    fontFamily: FontFamily.body,
    fontSize: TypeScale.bodySm,
    color: colors.textMuted,
  },
  modalSafe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  modalTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: TypeScale.titleLg,
    color: colors.primary,
  },
  modalClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceContainerLow,
  },
  modalScroll: {
    flex: 1,
  },
  modalContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
    gap: Spacing.lg,
  },
  modalLoadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
  },
  modalLoadingText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: TypeScale.bodyMd,
    color: colors.textMuted,
  },
  friendsSummaryRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: Radii.md,
    padding: Spacing.lg,
    gap: 4,
  },
  summaryValue: {
    fontFamily: FontFamily.displayBold,
    fontSize: TypeScale.headlineMd,
    color: colors.primary,
  },
  summaryLabel: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: TypeScale.label,
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  friendsSection: {
    gap: Spacing.md,
  },
  searchRow: {
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: Radii.md,
    padding: Spacing.sm,
  },
  searchInput: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    fontFamily: FontFamily.body,
    fontSize: TypeScale.bodyMd,
    color: colors.text,
  },
  searchState: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: Radii.md,
    padding: Spacing.md,
  },
  friendsSectionTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: TypeScale.titleMd,
    color: colors.primary,
  },
  friendCard: {
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: Radii.md,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  friendCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: Spacing.md,
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontFamily: FontFamily.displayBold,
    fontSize: TypeScale.bodyLg,
    color: colors.text,
  },
  friendMeta: {
    fontFamily: FontFamily.body,
    fontSize: TypeScale.bodySm,
    color: colors.textMuted,
    marginTop: 2,
  },
  requestActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  addFriendButton: {
    backgroundColor: colors.primary,
    borderRadius: Radii.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
  },
  addFriendButtonSent: {
    backgroundColor: colors.surfaceContainerLow,
  },
  addFriendButtonText: {
    fontFamily: FontFamily.displayBold,
    fontSize: TypeScale.bodySm,
    color: colors.onPrimary,
  },
  acceptButton: {
    backgroundColor: colors.tertiary,
    borderRadius: Radii.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  acceptButtonText: {
    fontFamily: FontFamily.displayBold,
    fontSize: TypeScale.bodySm,
    color: colors.onPrimary,
  },
  rejectButton: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: Radii.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  rejectButtonText: {
    fontFamily: FontFamily.displayBold,
    fontSize: TypeScale.bodySm,
    color: colors.text,
  },
  sectionTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: TypeScale.bodyMd,
    color: colors.textMuted,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: Spacing.xs,
  },
  friendsBadge: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: TypeScale.bodySm,
    color: colors.tertiary,
  },
  emptyStateText: {
    fontFamily: FontFamily.body,
    fontSize: TypeScale.bodyMd,
    color: colors.textMuted,
    lineHeight: 22,
  },
});
}
