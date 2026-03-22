import type { AccessibilityMode, ScanResult, UserProfile } from "@/types";
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
