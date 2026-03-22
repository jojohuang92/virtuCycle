import type {
  AccessibilityMode,
  FriendProfile,
  FriendRequest,
  FriendsData,
  LeaderboardEntry,
  ScanResult,
  UserProfile,
} from "@/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type Session, type User } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";

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

function mapProfileRow(data: any, fallback?: Partial<FriendProfile>): FriendProfile {
  return {
    id: data?.id ?? fallback?.id ?? "",
    email: data?.email ?? fallback?.email ?? "",
    displayName:
      data?.full_name ??
      data?.display_name ??
      fallback?.displayName ??
      "VirtuCycle Member",
    scansThisMonth: data?.scans_this_month ?? fallback?.scansThisMonth ?? 0,
    ecoPoints: data?.eco_points ?? fallback?.ecoPoints ?? 0,
    level: data?.level ?? fallback?.level ?? 1,
    co2SavedKg: data?.co2_saved_kg ?? fallback?.co2SavedKg ?? 0,
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
  if (!supabase) {
    await AsyncStorage.removeItem("virtucycle_demo_user");
    return;
  }

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
      data.full_name ||
      "VirtuCycle Member",
    accessibilityMode: normalizeAccessibilityMode(
      user.user_metadata?.color_mode ?? data.color_mode,
    ),
    ecoPoints: data.eco_points ?? 0,
    level: data.level ?? 1,
    co2SavedKg: data.co2_saved_kg ?? 0,
    scansThisMonth: data.scans_this_month ?? 0,
    joinedAt: new Date(data.created_at).getTime(),
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
    .select("id, email, full_name, scans_this_month, eco_points, level, co2_saved_kg")
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
          eco_points,
          level,
          co2_saved_kg
        ),
        receiver:profiles!friend_requests_receiver_id_fkey (
          id,
          email,
          full_name,
          scans_this_month,
          eco_points,
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
    const isOutgoing = request.status === "pending" && request.senderId === user.id;

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
    .select("id, email, full_name, scans_this_month, eco_points, level, co2_saved_kg")
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
  if (!supabase || !user) {
    return createDemoFriendProfiles(user?.id ?? "");
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

export async function getMyFriendRequests(user: User | null | undefined): Promise<{
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
    rows.filter((r) => r.sender_id === user.id && r.status === "pending").map((r) => r.receiver_id),
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
  const currentEntry: LeaderboardEntry | null = currentProfile
    ? {
        id: currentProfile.id,
        email: currentProfile.email,
        displayName: currentProfile.displayName,
        scansThisMonth: currentProfile.scansThisMonth,
        ecoPoints: currentProfile.ecoPoints,
        level: currentProfile.level,
        co2SavedKg: currentProfile.co2SavedKg,
        isCurrentUser: true,
        rank: 1,
      }
    : null;

  if (!supabase || !user) {
    const demoFriends = createDemoFriendProfiles(user?.id ?? "");
    const entries = [currentEntry, ...demoFriends.map((friend) => ({
      ...friend,
      isCurrentUser: false,
      rank: 0,
    }))].filter((entry): entry is LeaderboardEntry => Boolean(entry));

    return entries
      .sort((a, b) => b.scansThisMonth - a.scansThisMonth)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
  }

  const { friendIds } = await getMyFriendRequests(user);

  if (friendIds.size === 0) {
    return currentEntry ? [{ ...currentEntry, rank: 1 }] : [];
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .in("id", Array.from(friendIds));

  if (error) throw error;

  const entries = [
    currentEntry,
    ...(data ?? []).map((row) => ({
      ...mapProfileRow(row),
      isCurrentUser: false,
      rank: 0,
    })),
  ].filter((entry): entry is LeaderboardEntry => Boolean(entry));

  return entries
    .sort((a, b) => b.scansThisMonth - a.scansThisMonth)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
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

  await supabase.from("scans").insert({
    user_id: userId,
    item: result.item,
    bin_type: result.binType,
    confidence: result.confidence,
    explanation: result.explanation,
    source: result.source,
    created_at: new Date(result.timestamp).toISOString(),
  });
}
