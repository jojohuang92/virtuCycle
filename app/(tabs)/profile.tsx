import ImpactReportContent from "@/components/ImpactReportContent";
import { AccessibilityColors, Radii, Spacing } from "@/constants/Colors";
import { FontFamily, TypeScale } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useSession } from "@/hooks/useSession";
import {
  getAllUsers,
  getMyFriendRequests,
  respondToFriendRequest,
  sendFriendRequest,
  signOut,
  updateAvatarUrl,
} from "@/services/supabase";
import type { AccessibilityMode, FriendProfile } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const AVATAR_OPTIONS = [
  "https://api.dicebear.com/9.x/adventurer/png?seed=Zoe&backgroundColor=b6e3f4",
  "https://api.dicebear.com/9.x/adventurer/png?seed=Felix&backgroundColor=c0aede",
  "https://api.dicebear.com/9.x/adventurer/png?seed=Luna&backgroundColor=d1d4f9",
  "https://api.dicebear.com/9.x/adventurer/png?seed=Kai&backgroundColor=ffd5dc",
  "https://api.dicebear.com/9.x/adventurer/png?seed=Nova&backgroundColor=b6e3f4",
  "https://api.dicebear.com/9.x/adventurer/png?seed=River&backgroundColor=c0aede",
  "https://api.dicebear.com/9.x/adventurer/png?seed=Sage&backgroundColor=ffdfbf",
  "https://api.dicebear.com/9.x/adventurer/png?seed=Ember&backgroundColor=d1d4f9",
  "https://api.dicebear.com/9.x/adventurer/png?seed=Atlas&backgroundColor=ffd5dc",
  "https://api.dicebear.com/9.x/adventurer/png?seed=Orion&backgroundColor=b6e3f4",
  "https://api.dicebear.com/9.x/adventurer/png?seed=Ivy&backgroundColor=ffdfbf",
  "https://api.dicebear.com/9.x/adventurer/png?seed=Echo&backgroundColor=c0aede",
];

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
  const { profile, loading, saveProfile, user, refreshProfile } = useSession();
  const [friendsVisible, setFriendsVisible] = useState(false);
  const [reportsVisible, setReportsVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendsActionId, setFriendsActionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [allUsers, setAllUsers] = useState<FriendProfile[]>([]);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const [incoming, setIncoming] = useState<
    { requestId: string; senderId: string }[]
  >([]);
  const [refreshing, setRefreshing] = useState(false);
  const [username, setUsername] = useState(profile?.displayName ?? "");
  const [savedUsername, setSavedUsername] = useState(
    profile?.displayName ?? "",
  );
  const [colorMode, setColorMode] = useState<AccessibilityMode>(
    profile?.accessibilityMode ?? "default",
  );
  const [isSavingName, setIsSavingName] = useState(false);
  const [isSavingAccessibility, setIsSavingAccessibility] = useState(false);

  const friends = allUsers.filter((u) => friendIds.has(u.id));
  const incomingProfiles = incoming
    .map((req) => ({
      ...req,
      profile: allUsers.find((u) => u.id === req.senderId),
    }))
    .filter((r): r is typeof r & { profile: FriendProfile } =>
      Boolean(r.profile),
    );
  const discoverUsers = allUsers.filter(
    (u) =>
      !friendIds.has(u.id) &&
      !incoming.some((r) => r.senderId === u.id) &&
      (searchQuery.trim() === "" ||
        u.displayName
          .toLowerCase()
          .includes(searchQuery.trim().toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.trim().toLowerCase())),
  );

  const loadUsers = useCallback(async () => {
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
  }, [user]);

  const loadFriendCount = useCallback(async () => {
    try {
      const requests = await getMyFriendRequests(user);
      setFriendIds(requests.friendIds);
      setIncoming(requests.incoming);
      setSentIds(requests.sentIds);
    } catch {
      // ignore
    }
  }, [user]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);

    try {
      await Promise.all([
        refreshProfile(),
        loadFriendCount(),
        friendsVisible ? loadUsers() : Promise.resolve(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [friendsVisible, loadFriendCount, loadUsers, refreshProfile]);

  useEffect(() => {
    if (user) void loadFriendCount();
  }, [loadFriendCount, user?.id]);

  useEffect(() => {
    if (friendsVisible) {
      void loadUsers();
    } else {
      setSearchQuery("");
    }
  }, [friendsVisible, user?.id]);

  useEffect(() => {
    setUsername(profile?.displayName ?? "");
    setSavedUsername(profile?.displayName ?? "");
    setColorMode(profile?.accessibilityMode ?? "default");
  }, [profile?.displayName, profile?.accessibilityMode]);

  const [avatarPickerVisible, setAvatarPickerVisible] = useState(false);

  async function handleSelectAvatar(url: string) {
    try {
      await updateAvatarUrl(user, url);
      await refreshProfile();
      setAvatarPickerVisible(false);
    } catch (e: any) {
      Alert.alert("Failed", e?.message ?? "Could not update avatar.");
    }
  }

  async function handleRespondToRequest(requestId: string, accept: boolean) {
    try {
      setFriendsActionId(requestId);
      await respondToFriendRequest(
        user,
        requestId,
        accept ? "accepted" : "rejected",
      );
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

    if (item.id === "settings") {
      setSettingsVisible(true);
      return;
    }

    if (item.id === "reports") {
      setReportsVisible(true);
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
    } catch {
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
    } catch {
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
        <View style={styles.heroSection}>
          <View style={styles.avatarWrapper}>
            <TouchableOpacity
              style={styles.avatar}
              onPress={() => setAvatarPickerVisible(true)}
              activeOpacity={0.8}
            >
              {profile?.avatarUrl ? (
                <Image
                  source={{ uri: profile.avatarUrl }}
                  style={styles.avatarImage}
                />
              ) : (
                <Ionicons name="person" size={72} color={colors.primary} />
              )}
              <View style={styles.avatarEditBadge}>
                <Ionicons name="color-wand" size={12} color="#ffffff" />
              </View>
            </TouchableOpacity>

            <View style={styles.levelBadge}>
              <Ionicons name="leaf" size={14} color="#ffffff" />
              <Text style={styles.levelText}>Level {profile?.level ?? 1}</Text>
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
                    {friendIds.size}{" "}
                    {friendIds.size === 1 ? "Friend" : "Friends"}
                  </Text>
                </>
              )}
            </View>
          </View>
        </View>

        <View style={styles.impactCard}>
          <View style={styles.impactCardTop}>
            <Ionicons name="sparkles" size={32} color={colors.primary} />
            <TouchableOpacity
              style={styles.reportBtn}
              onPress={() => setReportsVisible(true)}
            >
              <Text style={styles.reportBtnText}>View Full Report</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.impactStat}>
            {profile?.scansThisMonth ?? 0} Items Recycled
          </Text>
          <Text style={styles.impactSubtext}>
            You've diverted {(profile?.co2SavedKg ?? 0).toFixed(1)}kg of waste
            this month.
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
                <View style={styles.curatorItemTop}>
                  <View style={styles.curatorItemLeft}>
                    <View style={styles.curatorIconWrap}>
                      <Ionicons
                        name={item.icon}
                        size={22}
                        color={colors.primary}
                      />
                    </View>
                    <Text style={styles.curatorLabel}>{item.label}</Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={colors.outline}
                  />
                </View>
                <Text style={styles.curatorSublabel}>{item.sublabel}</Text>
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
                  <Text style={styles.sectionTitle}>
                    Friends ({friends.length})
                  </Text>
                  {friends.map((person) => (
                    <View key={person.id} style={styles.friendCard}>
                      <View style={styles.friendCardTop}>
                        <View style={styles.friendInfo}>
                          <Text style={styles.friendName}>
                            {person.displayName}
                          </Text>
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
                  <Text style={styles.sectionTitle}>
                    Requests ({incomingProfiles.length})
                  </Text>
                  {incomingProfiles.map(({ requestId, profile }) => (
                    <View key={requestId} style={styles.friendCard}>
                      <View style={styles.friendCardTop}>
                        <View style={styles.friendInfo}>
                          <Text style={styles.friendName}>
                            {profile.displayName}
                          </Text>
                          <Text style={styles.friendMeta}>{profile.email}</Text>
                        </View>
                        <View style={styles.requestActions}>
                          <TouchableOpacity
                            style={styles.acceptButton}
                            disabled={friendsActionId === requestId}
                            onPress={() =>
                              handleRespondToRequest(requestId, true)
                            }
                          >
                            <Text style={styles.acceptButtonText}>
                              {friendsActionId === requestId ? "..." : "Accept"}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.rejectButton}
                            disabled={friendsActionId === requestId}
                            onPress={() =>
                              handleRespondToRequest(requestId, false)
                            }
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
                  {searchQuery.trim()
                    ? "No matching users found."
                    : "No other users to discover."}
                </Text>
              ) : (
                discoverUsers.map((person) => (
                  <View key={person.id} style={styles.friendCard}>
                    <View style={styles.friendCardTop}>
                      <View style={styles.friendInfo}>
                        <Text style={styles.friendName}>
                          {person.displayName}
                        </Text>
                        <Text style={styles.friendMeta}>{person.email}</Text>
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.addFriendButton,
                          sentIds.has(person.id) && styles.addFriendButtonSent,
                        ]}
                        disabled={
                          friendsActionId === person.id ||
                          sentIds.has(person.id)
                        }
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

      <Modal
        visible={reportsVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setReportsVisible(false)}
      >
        <SafeAreaView style={styles.modalSafe} edges={["top", "bottom"]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Impact Reports</Text>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setReportsVisible(false)}
            >
              <Ionicons name="close" size={22} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <ImpactReportContent contentContainerStyle={styles.modalContent} />
        </SafeAreaView>
      </Modal>

      <Modal
        visible={settingsVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSettingsVisible(false)}
      >
        <SafeAreaView style={styles.modalSafe} edges={["top", "bottom"]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Settings</Text>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setSettingsVisible(false)}
            >
              <Ionicons name="close" size={22} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.settingsPreviewCard}>
              <Text style={styles.settingsPreviewEyebrow}>PROFILE PREVIEW</Text>
              <Text style={styles.settingsPreviewName}>
                {savedUsername || "Unnamed User"}
              </Text>
              <Text style={styles.settingsPreviewSubtext}>
                Personalize your account and accessibility settings.
              </Text>
            </View>

            <View style={styles.settingsSectionCard}>
              <Text style={styles.settingsSectionTitle}>Change Username</Text>
              <Text style={styles.settingsSectionSubtext}>
                Update the display name shown on your profile.
              </Text>

              <TextInput
                value={username}
                onChangeText={setUsername}
                placeholder="Enter your username"
                placeholderTextColor={colors.textMuted}
                style={styles.settingsInput}
              />

              <TouchableOpacity
                style={styles.primaryActionButton}
                onPress={handleSaveName}
                disabled={isSavingName}
              >
                <Text style={styles.primaryActionButtonText}>
                  {isSavingName ? "Saving..." : "Save Username"}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.settingsSectionCard}>
              <Text style={styles.settingsSectionTitle}>
                Color Blind Options
              </Text>
              <Text style={styles.settingsSectionSubtext}>
                Choose a color mode that works better for your vision.
              </Text>

              <View style={styles.settingsOptionGroup}>
                {(
                  Object.keys(ACCESSIBILITY_MODES) as Array<
                    keyof typeof ACCESSIBILITY_MODES
                  >
                ).map((modeKey) => {
                  const active = colorMode === modeKey;

                  return (
                    <TouchableOpacity
                      key={modeKey}
                      style={[
                        styles.settingsOptionButton,
                        active && styles.settingsOptionButtonActive,
                      ]}
                      onPress={() => setColorMode(modeKey)}
                    >
                      <View style={styles.settingsOptionLeft}>
                        <View
                          style={[
                            styles.settingsSwatch,
                            {
                              backgroundColor:
                                ACCESSIBILITY_MODES[modeKey].primary,
                            },
                          ]}
                        />
                        <Text
                          style={[
                            styles.settingsOptionText,
                            active && styles.settingsOptionTextActive,
                          ]}
                        >
                          {ACCESSIBILITY_MODES[modeKey].label}
                        </Text>
                      </View>

                      {active ? (
                        <Ionicons
                          name="checkmark-circle"
                          size={20}
                          color={colors.onPrimary}
                        />
                      ) : (
                        <Ionicons
                          name="ellipse-outline"
                          size={20}
                          color={colors.outline}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={styles.primaryActionButton}
                onPress={handleSaveAccessibility}
                disabled={isSavingAccessibility}
              >
                <Text style={styles.primaryActionButtonText}>
                  {isSavingAccessibility ? "Saving..." : "Save Accessibility"}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Avatar Picker Modal */}
      <Modal
        visible={avatarPickerVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAvatarPickerVisible(false)}
      >
        <SafeAreaView style={styles.modalSafe} edges={["top", "bottom"]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Choose Your Avatar</Text>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setAvatarPickerVisible(false)}
            >
              <Ionicons name="close" size={22} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.avatarGrid}>
            {AVATAR_OPTIONS.map((url) => (
              <TouchableOpacity
                key={url}
                onPress={() => handleSelectAvatar(url)}
                style={[
                  styles.avatarGridItem,
                  profile?.avatarUrl === url && styles.avatarGridItemSelected,
                ]}
                activeOpacity={0.75}
              >
                <Image source={{ uri: url }} style={styles.avatarGridImage} />
                {profile?.avatarUrl === url && (
                  <View style={styles.avatarGridCheck}>
                    <Ionicons name="checkmark" size={16} color="#ffffff" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
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
      overflow: "hidden",
    },
    avatarImage: {
      width: 160,
      height: 160,
      borderRadius: Radii.lg,
    },
    avatarEditBadge: {
      position: "absolute",
      bottom: 8,
      right: 8,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.primary,
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
      padding: Spacing.lg,
      backgroundColor: colors.surfaceContainerLow,
      borderRadius: Radii.md,
      gap: Spacing.sm,
    },
    curatorItemTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: Spacing.md,
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
    settingsPreviewCard: {
      backgroundColor: colors.surfaceContainerHighest,
      borderRadius: Radii.lg,
      padding: Spacing.xl,
      gap: Spacing.sm,
      marginTop: Spacing.md,
    },
    settingsPreviewEyebrow: {
      fontFamily: FontFamily.displayBold,
      fontSize: TypeScale.bodySm,
      color: colors.textMuted,
      letterSpacing: 1,
    },
    settingsPreviewName: {
      fontFamily: FontFamily.displayBold,
      fontSize: TypeScale.headlineMd,
      color: colors.primary,
      letterSpacing: -0.5,
    },
    settingsPreviewSubtext: {
      fontFamily: FontFamily.body,
      fontSize: TypeScale.bodyMd,
      color: colors.textMuted,
      lineHeight: 22,
    },
    settingsSectionCard: {
      backgroundColor: colors.surfaceContainerHighest,
      borderRadius: Radii.lg,
      padding: Spacing.xl,
      gap: Spacing.md,
    },
    settingsSectionTitle: {
      fontFamily: FontFamily.displayBold,
      fontSize: TypeScale.titleMd,
      color: colors.primary,
    },
    settingsSectionSubtext: {
      fontFamily: FontFamily.body,
      fontSize: TypeScale.bodyMd,
      color: colors.textMuted,
      lineHeight: 22,
    },
    settingsInput: {
      backgroundColor: colors.surfaceContainerLow,
      borderRadius: Radii.md,
      paddingHorizontal: Spacing.lg,
      paddingVertical: 14,
      fontFamily: FontFamily.body,
      fontSize: TypeScale.bodyMd,
      color: colors.text,
    },
    primaryActionButton: {
      backgroundColor: colors.primary,
      borderRadius: Radii.full,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    primaryActionButtonText: {
      fontFamily: FontFamily.displayBold,
      fontSize: TypeScale.bodyMd,
      color: colors.onPrimary,
    },
    settingsOptionGroup: {
      gap: Spacing.sm,
    },
    settingsOptionButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderRadius: Radii.md,
      paddingHorizontal: Spacing.lg,
      paddingVertical: 14,
      backgroundColor: colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    },
    settingsOptionButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    settingsOptionLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.md,
    },
    settingsSwatch: {
      width: 16,
      height: 16,
      borderRadius: 8,
    },
    settingsOptionText: {
      fontFamily: FontFamily.bodySemiBold,
      fontSize: TypeScale.bodyMd,
      color: colors.primary,
    },
    settingsOptionTextActive: {
      color: colors.onPrimary,
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
    avatarGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      padding: Spacing.md,
      gap: Spacing.md,
      justifyContent: "center",
    },
    avatarGridItem: {
      width: 100,
      height: 100,
      borderRadius: Radii.md,
      overflow: "hidden",
      borderWidth: 2,
      borderColor: "transparent",
    },
    avatarGridItemSelected: {
      borderColor: colors.primary,
    },
    avatarGridImage: {
      width: 100,
      height: 100,
    },
    avatarGridCheck: {
      position: "absolute",
      bottom: 4,
      right: 4,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
  });
}
