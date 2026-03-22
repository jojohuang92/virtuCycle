import type {
  AccessibilityMode,
  FriendProfile,
  FriendRequest,
  FriendsData,
  LeaderboardEntry,
  QuickTipRecord,
  RecycledItemRecord,
  ScanResult,
  UserProfile,
} from "@/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type Session, type User } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";
import {
  getQuickTipsHistory as getLocalQuickTipsHistory,
  getRecycledHistory as getLocalRecycledHistory,
  saveQuickTipHistory as saveLocalQuickTipHistory,
  saveRecycledHistory as saveLocalRecycledHistory,
} from "./history";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const secureStorage = {
  getItem: async (key: string) => SecureStore.getItemAsync(key),
  setItem: async (key: string, value: string) =>
    SecureStore.setItemAsync(key, value),
  removeItem: async (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          storage: secureStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;

export function isSupabaseConfigured() {
  return Boolean(supabase);
}

function mapProfileRow(
  data: any,
  fallback?: Partial<FriendProfile>,
): FriendProfile {
  return {
    id: data?.id ?? fallback?.id ?? "",
    email: data?.email ?? fallback?.email ?? "",
    displayName:
      data?.full_name ??
      data?.displayName ??
      data?.display_name ??
      fallback?.displayName ??
      "VirtuCycle Member",
    scansThisMonth:
      data?.scans_this_month ??
      data?.scansThisMonth ??
      fallback?.scansThisMonth ??
      0,
    ecoPoints: data?.eco_points ?? data?.ecoPoints ?? fallback?.ecoPoints ?? 0,
    level: data?.level ?? fallback?.level ?? 1,
    co2SavedKg:
      data?.co2_saved_kg ?? data?.co2SavedKg ?? fallback?.co2SavedKg ?? 0,
  };
}

function mapFriendRequestRow(data: any): FriendRequest {
  return {
    id: String(data.id),
    senderId: data.sender_id,
    receiverId: data.receiver_id,
    status: data.status,
    createdAt: new Date(data.created_at).getTime(),
    senderProfile: data.sender ? mapProfileRow(data.sender) : undefined,
    receiverProfile: data.receiver ? mapProfileRow(data.receiver) : undefined,
  };
}

function getCurrentMonthStartIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

const SCAN_TIME_COLUMNS = ["created_at", "scanned_at", "timestamp"] as const;

function extractMissingScanColumnName(error: any): string | null {
  const message = typeof error?.message === "string" ? error.message : "";

  if (error?.code === "42703") {
    const match = message.match(
      /column scans\.([a-zA-Z0-9_]+) does not exist/i,
    );
    return match?.[1] ?? null;
  }

  if (error?.code === "PGRST204") {
    const match = message.match(
      /Could not find the '([^']+)' column of 'scans'/i,
    );
    return match?.[1] ?? null;
  }

  return null;
}

function isMissingScanColumnError(error: any, column: string) {
  return extractMissingScanColumnName(error) === column;
}

async function tryInsertScanPayload(
  payload: Record<string, unknown>,
  preservedColumns: string[] = [],
): Promise<"inserted" | "retry-next-payload"> {
  if (!supabase) {
    return "inserted";
  }

  const nextPayload: Record<string, unknown> = { ...payload };

  while (true) {
    const { error } = await supabase.from("scans").insert(nextPayload);

    if (!error) {
      return "inserted";
    }

    const missingColumn = extractMissingScanColumnName(error);
    if (!missingColumn || !(missingColumn in nextPayload)) {
      throw error;
    }

    if (preservedColumns.includes(missingColumn)) {
      return "retry-next-payload";
    }

    delete nextPayload[missingColumn];
  }
}

async function getScanRowsForUsers(
  userIds: string[],
  monthStartIso?: string,
): Promise<Array<{ user_id: string }>> {
  if (!supabase || userIds.length === 0) {
    return [];
  }

  if (monthStartIso) {
    for (const column of SCAN_TIME_COLUMNS) {
      const { data, error } = await supabase
        .from("scans")
        .select("user_id")
        .in("user_id", userIds)
        .gte(column, monthStartIso);

      if (!error) {
        return (data ?? []) as Array<{ user_id: string }>;
      }

      if (!isMissingScanColumnError(error, column)) {
        throw error;
      }
    }
  }

  const { data, error } = await supabase
    .from("scans")
    .select("user_id")
    .in("user_id", userIds);

  if (error) {
    throw error;
  }

  return (data ?? []) as Array<{ user_id: string }>;
}

async function insertScanRow(result: ScanResult, userId: string) {
  if (!supabase) {
    return;
  }

  const basePayload: Record<string, unknown> = {
    user_id: userId,
    item: result.item,
    bin_type: result.binType,
    confidence: result.confidence,
    explanation: result.explanation,
    source: result.source,
  };
  const timestampIso = new Date(result.timestamp).toISOString();

  for (const column of SCAN_TIME_COLUMNS) {
    const insertResult = await tryInsertScanPayload(
      {
        ...basePayload,
        [column]: timestampIso,
      },
      [column],
    );

    if (insertResult === "inserted") {
      return;
    }
  }

  const insertResult = await tryInsertScanPayload(basePayload);
  if (insertResult === "inserted") {
    return;
  }

  throw new Error("Unable to save scan result with the current scans schema.");
}

function applyLeaderboardRanks(
  entries: Array<Omit<LeaderboardEntry, "rank">>,
): LeaderboardEntry[] {
  const sorted = [...entries].sort((left, right) => {
    if (right.scansThisMonth !== left.scansThisMonth) {
      return right.scansThisMonth - left.scansThisMonth;
    }

    return left.displayName.localeCompare(right.displayName);
  });

  let previousScanCount: number | null = null;
  let previousRank = 0;

  return sorted.map((entry, index) => {
    const rank =
      previousScanCount === entry.scansThisMonth ? previousRank : index + 1;

    previousScanCount = entry.scansThisMonth;
    previousRank = rank;

    return {
      ...entry,
      rank,
    };
  });
}

function createDemoFriendProfiles(currentUserId: string): FriendProfile[] {
  return [
    {
      id: "demo-friend-ava",
      email: "ava@virtucycle.demo",
      displayName: "Ava Green",
      scansThisMonth: 41,
      ecoPoints: 13780,
      level: 44,
      co2SavedKg: 126.4,
    },
    {
      id: "demo-friend-miles",
      email: "miles@virtucycle.demo",
      displayName: "Miles Carter",
      scansThisMonth: 33,
      ecoPoints: 11240,
      level: 38,
      co2SavedKg: 109.2,
    },
    {
      id: "demo-friend-noor",
      email: "noor@virtucycle.demo",
      displayName: "Noor Patel",
      scansThisMonth: 19,
      ecoPoints: 9240,
      level: 29,
      co2SavedKg: 78.6,
    },
  ].filter((friend) => friend.id !== currentUserId);
}

function normalizeAccessibilityMode(value: unknown): AccessibilityMode {
  if (
    value === "default" ||
    value === "protanopia" ||
    value === "deuteranopia" ||
    value === "tritanopia"
  ) {
    return value;
  }

  return "default";
}

export async function signInWithEmail(email: string, password: string) {
  if (!supabase) {
    throw new Error("Supabase environment variables are missing.");
  }

  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string,
) {
  if (!supabase) {
    throw new Error("Supabase environment variables are missing.");
  }

  const response = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: displayName, display_name: displayName },
      emailRedirectTo: Linking.createURL("/"),
    },
  });

  return response;
}

export async function signOut() {
  await AsyncStorage.removeItem("virtucycle_demo_user");
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function getSession(): Promise<Session | null> {
  if (!supabase) {
    return null;
  }

  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function storeDemoSession(email: string) {
  const demoUser: UserProfile = {
    id: "demo-user",
    email,
    displayName: email.split("@")[0],
    accessibilityMode: "default",
    ecoPoints: 12450,
    level: 42,
    co2SavedKg: 1240,
    scansThisMonth: 28,
    joinedAt: Date.now(),
  };

  await AsyncStorage.setItem("virtucycle_demo_user", JSON.stringify(demoUser));
}

export async function getDemoSession(): Promise<UserProfile | null> {
  const raw = await AsyncStorage.getItem("virtucycle_demo_user");
  if (!raw) {
    return null;
  }

  const parsed = JSON.parse(raw) as Partial<UserProfile>;

  return {
    id: parsed.id ?? "demo-user",
    email: parsed.email ?? "",
    displayName: parsed.displayName ?? "VirtuCycle Member",
    accessibilityMode: normalizeAccessibilityMode(parsed.accessibilityMode),
    ecoPoints: parsed.ecoPoints ?? 12450,
    level: parsed.level ?? 42,
    co2SavedKg: parsed.co2SavedKg ?? 1240,
    scansThisMonth: parsed.scansThisMonth ?? 28,
    joinedAt: parsed.joinedAt ?? Date.now(),
  };
}

export async function getProfile(
  user?: User | null,
): Promise<UserProfile | null> {
  if (!supabase || !user) {
    return getDemoSession();
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) {
    return {
      id: user.id,
      email: user.email || "",
      displayName:
        (user.user_metadata?.display_name as string) || "VirtuCycle Member",
      accessibilityMode: normalizeAccessibilityMode(
        user.user_metadata?.color_mode,
      ),
      ecoPoints: 12450,
      level: 42,
      co2SavedKg: 1240,
      scansThisMonth: 28,
      joinedAt: Date.now(),
    };
  }

  return {
    id: data.id,
    email: data.email,
    displayName:
      (user.user_metadata?.display_name as string) ||
      data.display_name ||
      data.displayName ||
      data.full_name ||
      "VirtuCycle Member",
    accessibilityMode: normalizeAccessibilityMode(
      user.user_metadata?.color_mode ?? data.color_mode,
    ),
    ecoPoints: data.eco_points ?? data.ecoPoints ?? 0,
    level: data.level ?? 1,
    co2SavedKg: data.co2_saved_kg ?? data.co2SavedKg ?? 0,
    scansThisMonth: data.scans_this_month ?? data.scansThisMonth ?? 0,
    joinedAt: new Date(data.created_at).getTime(),
    avatarUrl: data.avatar_url ?? null,
  };
}

export async function getFriendsData(
  user: User | null | undefined,
): Promise<FriendsData> {
  if (!supabase || !user) {
    const demoFriends = createDemoFriendProfiles(user?.id ?? "");

    return {
      friends: demoFriends.slice(0, 2),
      discoverableUsers: demoFriends.slice(2),
      incomingRequests: [
        {
          id: "demo-request-incoming",
          senderId: "demo-friend-noor",
          receiverId: user?.id ?? "demo-user",
          status: "pending" as const,
          createdAt: Date.now() - 1000 * 60 * 60 * 18,
          senderProfile: demoFriends[2],
        },
      ].filter((request) => request.senderProfile),
      outgoingRequests: [],
    };
  }

  const { data: profilesData, error: profilesError } = await supabase
    .from("profiles")
    .select("id, email, full_name, scans_this_month, level, co2_saved_kg")
    .neq("id", user.id);

  if (profilesError) {
    throw profilesError;
  }

  const { data: requestsData, error: requestsError } = await supabase
    .from("friend_requests")
    .select(
      `
        id,
        sender_id,
        receiver_id,
        status,
        created_at,
        sender:profiles!friend_requests_sender_id_fkey (
          id,
          email,
          full_name,
          scans_this_month,
          level,
          co2_saved_kg
        ),
        receiver:profiles!friend_requests_receiver_id_fkey (
          id,
          email,
          full_name,
          scans_this_month,
          level,
          co2_saved_kg
        )
      `,
    )
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

  if (requestsError) {
    throw requestsError;
  }

  const requests = (requestsData ?? []).map(mapFriendRequestRow);
  const relatedUserIds = new Set<string>();

  const friends = requests
    .filter((request) => request.status === "accepted")
    .map((request) => {
      const otherProfile =
        request.senderId === user.id
          ? request.receiverProfile
          : request.senderProfile;

      if (otherProfile) {
        relatedUserIds.add(otherProfile.id);
      }

      return otherProfile;
    })
    .filter((profile): profile is FriendProfile => Boolean(profile));

  const incomingRequests = requests.filter((request) => {
    const isIncoming =
      request.status === "pending" && request.receiverId === user.id;

    if (isIncoming && request.senderProfile) {
      relatedUserIds.add(request.senderProfile.id);
    }

    return isIncoming;
  });

  const outgoingRequests = requests.filter((request) => {
    const isOutgoing =
      request.status === "pending" && request.senderId === user.id;

    if (isOutgoing && request.receiverProfile) {
      relatedUserIds.add(request.receiverProfile.id);
    }

    return isOutgoing;
  });

  const discoverableUsers = (profilesData ?? [])
    .map((profile) => mapProfileRow(profile))
    .filter((profile) => !relatedUserIds.has(profile.id));

  return {
    friends,
    discoverableUsers,
    incomingRequests,
    outgoingRequests,
  };
}

export async function searchUsers(
  user: User | null | undefined,
  query: string,
): Promise<FriendProfile[]> {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return [];
  }

  if (!supabase || !user) {
    return createDemoFriendProfiles(user?.id ?? "").filter((profile) => {
      const haystack = `${profile.displayName} ${profile.email}`.toLowerCase();
      return haystack.includes(trimmedQuery.toLowerCase());
    });
  }

  const friendsData = await getFriendsData(user);
  const excludedIds = new Set<string>([
    user.id,
    ...friendsData.friends.map((friend) => friend.id),
    ...friendsData.incomingRequests
      .map((request) => request.senderProfile?.id)
      .filter((id): id is string => Boolean(id)),
    ...friendsData.outgoingRequests
      .map((request) => request.receiverProfile?.id)
      .filter((id): id is string => Boolean(id)),
  ]);

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, scans_this_month, level, co2_saved_kg")
    .neq("id", user.id)
    .limit(100);

  if (error) {
    throw error;
  }

  const loweredQuery = trimmedQuery.toLowerCase();

  return (data ?? [])
    .map((profile) => mapProfileRow(profile))
    .filter((profile) => {
      const haystack = `${profile.displayName} ${profile.email}`.toLowerCase();
      return haystack.includes(loweredQuery);
    })
    .filter((profile) => !excludedIds.has(profile.id));
}

export async function getAllUsers(
  user: User | null | undefined,
): Promise<FriendProfile[]> {
  if (!supabase) {
    return createDemoFriendProfiles(user?.id ?? "");
  }
  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .neq("id", user.id)
    .order("full_name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapProfileRow(row));
}

export async function getMyFriendRequests(
  user: User | null | undefined,
): Promise<{
  sentIds: Set<string>;
  incoming: { requestId: string; senderId: string }[];
  friendIds: Set<string>;
}> {
  if (!supabase || !user) {
    return { sentIds: new Set(), incoming: [], friendIds: new Set() };
  }

  const { data, error } = await supabase
    .from("friend_requests")
    .select("id, sender_id, receiver_id, status")
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

  if (error) throw error;

  const rows = data ?? [];
  const sentIds = new Set(
    rows
      .filter((r) => r.sender_id === user.id && r.status === "pending")
      .map((r) => r.receiver_id),
  );
  const incoming = rows
    .filter((r) => r.receiver_id === user.id && r.status === "pending")
    .map((r) => ({ requestId: String(r.id), senderId: r.sender_id }));
  const friendIds = new Set(
    rows
      .filter((r) => r.status === "accepted")
      .map((r) => (r.sender_id === user.id ? r.receiver_id : r.sender_id)),
  );

  return { sentIds, incoming, friendIds };
}

export async function updateAvatarUrl(
  user: User | null | undefined,
  avatarUrl: string,
): Promise<void> {
  if (!supabase || !user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", user.id);

  if (error) throw error;
}

export async function sendFriendRequest(
  user: User | null | undefined,
  receiverId: string,
) {
  if (!supabase || !user) {
    return;
  }

  const { error } = await supabase.from("friend_requests").insert({
    sender_id: user.id,
    receiver_id: receiverId,
    status: "pending",
  });

  if (error) {
    throw error;
  }
}

export async function respondToFriendRequest(
  user: User | null | undefined,
  requestId: string,
  status: "accepted" | "rejected",
) {
  if (!supabase || !user) {
    return;
  }

  const { error } = await supabase
    .from("friend_requests")
    .update({ status })
    .eq("id", requestId)
    .eq("receiver_id", user.id);

  if (error) {
    throw error;
  }
}

export async function getFriendsLeaderboard(
  user: User | null | undefined,
  currentProfile: UserProfile | null,
): Promise<LeaderboardEntry[]> {
  const currentEntryBase: Omit<LeaderboardEntry, "rank"> | null = currentProfile
    ? {
        id: currentProfile.id,
        email: currentProfile.email,
        displayName: currentProfile.displayName,
        scansThisMonth: currentProfile.scansThisMonth,
        ecoPoints: currentProfile.ecoPoints,
        level: currentProfile.level,
        co2SavedKg: currentProfile.co2SavedKg,
        isCurrentUser: true,
      }
    : null;

  if (!supabase) {
    const demoFriends = createDemoFriendProfiles(user?.id ?? "");
    const entries = [
      currentEntryBase,
      ...demoFriends.map((friend) => ({
        ...friend,
        isCurrentUser: false,
      })),
    ].filter((entry): entry is Omit<LeaderboardEntry, "rank"> =>
      Boolean(entry),
    );

    return applyLeaderboardRanks(entries);
  }

  if (!user) {
    return currentEntryBase ? [{ ...currentEntryBase, rank: 1 }] : [];
  }

  const { friendIds } = await getMyFriendRequests(user);
  const leaderboardUserIds = [user.id, ...Array.from(friendIds)];
  const monthStartIso = getCurrentMonthStartIso();

  if (friendIds.size === 0) {
    const ownScans = await getScanRowsForUsers([user.id], monthStartIso);
    const scanCount = Math.max(
      ownScans?.length ?? 0,
      currentEntryBase?.scansThisMonth ?? 0,
    );

    return currentEntryBase
      ? [{ ...currentEntryBase, scansThisMonth: scanCount, rank: 1 }]
      : [];
  }

  const [{ data: profilesData, error: profilesError }, scansData] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, email, full_name, scans_this_month, level, co2_saved_kg")
        .in("id", leaderboardUserIds),
      getScanRowsForUsers(leaderboardUserIds, monthStartIso),
    ]);

  if (profilesError) throw profilesError;

  const scanCounts = new Map<string, number>();
  for (const scan of scansData ?? []) {
    const scanUserId = scan.user_id as string;
    scanCounts.set(scanUserId, (scanCounts.get(scanUserId) ?? 0) + 1);
  }

  const currentEntry = currentEntryBase
    ? {
        ...currentEntryBase,
        scansThisMonth: Math.max(
          scanCounts.get(currentEntryBase.id) ?? 0,
          currentEntryBase.scansThisMonth,
        ),
      }
    : null;

  const entries = [
    currentEntry,
    ...(profilesData ?? [])
      .filter((row) => row.id !== currentEntryBase?.id)
      .map((row) => ({
        ...mapProfileRow(row),
        scansThisMonth: Math.max(
          scanCounts.get(row.id) ?? 0,
          row.scans_this_month ?? 0,
        ),
        isCurrentUser: false,
      })),
  ].filter((entry): entry is Omit<LeaderboardEntry, "rank"> => Boolean(entry));

  return applyLeaderboardRanks(entries);
}

export async function updateProfileSettings(
  user: User | null | undefined,
  updates: {
    displayName?: string;
    accessibilityMode?: AccessibilityMode;
  },
): Promise<User | null> {
  if (!supabase || !user) {
    const demoProfile = await getDemoSession();

    if (!demoProfile) {
      return null;
    }

    const nextProfile: UserProfile = {
      ...demoProfile,
      displayName: updates.displayName ?? demoProfile.displayName,
      accessibilityMode:
        updates.accessibilityMode ?? demoProfile.accessibilityMode,
    };

    await AsyncStorage.setItem(
      "virtucycle_demo_user",
      JSON.stringify(nextProfile),
    );
    return null;
  }

  const metadataUpdates: Record<string, string> = {};

  if (updates.displayName) {
    metadataUpdates.display_name = updates.displayName;
    metadataUpdates.full_name = updates.displayName;
  }

  if (updates.accessibilityMode) {
    metadataUpdates.color_mode = updates.accessibilityMode;
  }

  if (Object.keys(metadataUpdates).length > 0) {
    const { data, error } = await supabase.auth.updateUser({
      data: metadataUpdates,
    });

    if (error) {
      throw error;
    }

    if (updates.displayName) {
      supabase
        .from("profiles")
        .upsert(
          {
            id: user.id,
            email: user.email ?? "",
            full_name: updates.displayName,
          },
          { onConflict: "id" },
        )
        .then(({ error: profileError }) => {
          if (profileError) {
            console.warn("Profile table update failed:", profileError.message);
          }
        });
    }

    return data.user ?? user;
  }

  return user;
}

export async function saveScanResult(result: ScanResult, userId?: string) {
  if (!supabase || !userId) {
    return;
  }

  await insertScanRow(result, userId);
}

const RECYCLE_IMPACT: Record<
  ScanResult["binType"],
  { points: number; co2Kg: number }
> = {
  recycling: { points: 15, co2Kg: 0.35 },
  compost: { points: 12, co2Kg: 0.28 },
  trash: { points: 5, co2Kg: 0.1 },
  hazardous: { points: 20, co2Kg: 0.45 },
  unknown: { points: 3, co2Kg: 0.02 },
};

const RECYCLED_ITEMS_TABLE = "recycled_items";
const QUICK_TIPS_TABLE = "quick_tips";

function mapQuickTipRow(data: any): QuickTipRecord {
  const source = data?.source === "gemini" ? "gemini" : "fallback";

  return {
    id: String(data?.id ?? ""),
    userId: data?.user_id ?? data?.userId ?? undefined,
    text: data?.tip ?? data?.text ?? "",
    city: data?.city ?? "General",
    state: data?.state ?? "",
    source,
    createdAt: new Date(
      data?.created_at ?? data?.createdAt ?? Date.now(),
    ).getTime(),
  };
}

function mapRecycledItemRow(data: any): RecycledItemRecord {
  const scannedAtValue =
    data?.scanned_at ?? data?.scannedAt ?? data?.created_at ?? Date.now();
  const recycledAtValue =
    data?.recycled_at ?? data?.recycledAt ?? data?.created_at ?? Date.now();
  const source =
    data?.source === "mlkit" ||
    data?.source === "gemini" ||
    data?.source === "claude" ||
    data?.source === "fallback"
      ? data.source
      : "fallback";
  const binType =
    data?.bin_type in RECYCLE_IMPACT
      ? data.bin_type
      : data?.binType in RECYCLE_IMPACT
        ? data.binType
        : "unknown";

  return {
    id:
      String(data?.id ?? "") ||
      `${data?.user_id ?? data?.userId ?? "guest"}-${recycledAtValue}`,
    userId: data?.user_id ?? data?.userId ?? undefined,
    item: data?.item ?? "Unknown item",
    binType,
    confidence: Number(data?.confidence ?? 0),
    explanation: data?.explanation ?? "",
    source,
    scannedAt: new Date(scannedAtValue).getTime(),
    recycledAt: new Date(recycledAtValue).getTime(),
    impactPoints: Number(data?.impact_points ?? data?.impactPoints ?? 0),
    impactCo2Kg: Number(data?.impact_co2_kg ?? data?.impactCo2Kg ?? 0),
  };
}

function createRecycledItemRecord(
  result: ScanResult,
  impact: { points: number; co2Kg: number },
  userId?: string,
): RecycledItemRecord {
  const recycledAt = Date.now();

  return {
    id: `${userId ?? "guest"}-${recycledAt}-${result.item}`,
    userId,
    item: result.item,
    binType: result.binType,
    confidence: result.confidence,
    explanation: result.explanation,
    source: result.source,
    scannedAt: result.timestamp,
    recycledAt,
    impactPoints: impact.points,
    impactCo2Kg: impact.co2Kg,
  };
}

function createQuickTipRecord(
  tip: Pick<QuickTipRecord, "text" | "city" | "state" | "source">,
  userId?: string,
): QuickTipRecord {
  const createdAt = Date.now();

  return {
    id: `${userId ?? "guest"}-${createdAt}-quick-tip`,
    userId,
    text: tip.text,
    city: tip.city,
    state: tip.state,
    source: tip.source,
    createdAt,
  };
}

export async function getQuickTipsHistory(
  userId?: string,
): Promise<QuickTipRecord[]> {
  if (!supabase || !userId) {
    return getLocalQuickTipsHistory(userId);
  }

  const { data, error } = await supabase
    .from(QUICK_TIPS_TABLE)
    .select("id, user_id, tip, city, state, source, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn(
      "Quick tip history query failed, falling back to local cache:",
      error.message,
    );
    return getLocalQuickTipsHistory(userId);
  }

  return (data ?? []).map(mapQuickTipRow);
}

export async function storeQuickTip(
  tip: Pick<QuickTipRecord, "text" | "city" | "state" | "source">,
  userId?: string,
): Promise<QuickTipRecord> {
  const quickTipRecord = createQuickTipRecord(tip, userId);

  if (!supabase || !userId) {
    await saveLocalQuickTipHistory(quickTipRecord);
    return quickTipRecord;
  }

  const { error } = await supabase.from(QUICK_TIPS_TABLE).insert({
    id: quickTipRecord.id,
    user_id: userId,
    tip: quickTipRecord.text,
    city: quickTipRecord.city,
    state: quickTipRecord.state,
    source: quickTipRecord.source,
    created_at: new Date(quickTipRecord.createdAt).toISOString(),
  });

  if (error) {
    throw error;
  }

  await saveLocalQuickTipHistory(quickTipRecord);
  return quickTipRecord;
}

export async function getRecycledHistory(
  userId?: string,
): Promise<RecycledItemRecord[]> {
  if (!supabase || !userId) {
    return getLocalRecycledHistory(userId);
  }

  const { data, error } = await supabase
    .from(RECYCLED_ITEMS_TABLE)
    .select(
      "id, user_id, item, bin_type, confidence, explanation, source, scanned_at, recycled_at, impact_points, impact_co2_kg",
    )
    .eq("user_id", userId)
    .order("recycled_at", { ascending: false });

  if (error) {
    console.warn(
      "Recycled history query failed, falling back to local cache:",
      error.message,
    );
    return getLocalRecycledHistory(userId);
  }

  return (data ?? []).map(mapRecycledItemRow);
}

export async function recordRecycledItem(result: ScanResult, userId?: string) {
  const impact = RECYCLE_IMPACT[result.binType] ?? RECYCLE_IMPACT.unknown;
  const recycledRecord = createRecycledItemRecord(result, impact, userId);

  if (!supabase || !userId) {
    await saveLocalRecycledHistory(recycledRecord);
    const demoProfile = await getDemoSession();
    if (!demoProfile) {
      return;
    }

    const nextProfile: UserProfile = {
      ...demoProfile,
      scansThisMonth: demoProfile.scansThisMonth + 1,
      ecoPoints: demoProfile.ecoPoints + impact.points,
      co2SavedKg: Number((demoProfile.co2SavedKg + impact.co2Kg).toFixed(2)),
    };

    await AsyncStorage.setItem(
      "virtucycle_demo_user",
      JSON.stringify(nextProfile),
    );
    return;
  }

  const { error: recycledItemError } = await supabase
    .from(RECYCLED_ITEMS_TABLE)
    .insert({
      id: recycledRecord.id,
      user_id: userId,
      item: recycledRecord.item,
      bin_type: recycledRecord.binType,
      confidence: recycledRecord.confidence,
      explanation: recycledRecord.explanation,
      source: recycledRecord.source,
      scanned_at: new Date(recycledRecord.scannedAt).toISOString(),
      recycled_at: new Date(recycledRecord.recycledAt).toISOString(),
      impact_points: recycledRecord.impactPoints,
      impact_co2_kg: recycledRecord.impactCo2Kg,
    });

  if (recycledItemError) {
    throw recycledItemError;
  }

  const { data: profile, error: loadError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (loadError) {
    throw loadError;
  }

  const currentScans =
    profile?.scans_this_month ?? profile?.scansThisMonth ?? 0;
  const currentCo2 = profile?.co2_saved_kg ?? profile?.co2SavedKg ?? 0;
  const nextCo2 = Number((currentCo2 + impact.co2Kg).toFixed(2));

  const updatePayload: Record<string, number> = {};

  if (profile?.scans_this_month !== undefined) {
    updatePayload.scans_this_month = currentScans + 1;
  } else if (profile?.scansThisMonth !== undefined) {
    updatePayload.scansThisMonth = currentScans + 1;
  }

  if (profile?.co2_saved_kg !== undefined) {
    updatePayload.co2_saved_kg = nextCo2;
  } else if (profile?.co2SavedKg !== undefined) {
    updatePayload.co2SavedKg = nextCo2;
  }

  let updateError = null;

  if (profile && Object.keys(updatePayload).length > 0) {
    const { error } = await supabase
      .from("profiles")
      .update(updatePayload)
      .eq("id", userId);

    updateError = error;
  } else if (profile) {
    updateError = new Error(
      "No recyclable stat columns were found on the profile row.",
    );
  } else {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const currentUser = session?.user;

    const insertPayload: Record<string, string | number> = {
      id: userId,
      email: currentUser?.email ?? "",
      full_name:
        (currentUser?.user_metadata?.full_name as string | undefined) ??
        (currentUser?.user_metadata?.display_name as string | undefined) ??
        "VirtuCycle Member",
    };

    if (updatePayload.scans_this_month !== undefined) {
      insertPayload.scans_this_month = updatePayload.scans_this_month;
    }
    if (updatePayload.scansThisMonth !== undefined) {
      insertPayload.scansThisMonth = updatePayload.scansThisMonth;
    }
    if (updatePayload.co2_saved_kg !== undefined) {
      insertPayload.co2_saved_kg = updatePayload.co2_saved_kg;
    }
    if (updatePayload.co2SavedKg !== undefined) {
      insertPayload.co2SavedKg = updatePayload.co2SavedKg;
    }

    const { error } = await supabase.from("profiles").insert(insertPayload);

    updateError = error;
  }

  if (updateError) {
    throw updateError;
  }

  await saveLocalRecycledHistory(recycledRecord);
}
