import type { ScanResult, UserProfile } from "@/types";
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
  return raw ? (JSON.parse(raw) as UserProfile) : null;
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
    displayName: data.full_name,
    ecoPoints: data.eco_points ?? 0,
    level: data.level ?? 1,
    co2SavedKg: data.co2_saved_kg ?? 0,
    scansThisMonth: data.scans_this_month ?? 0,
    joinedAt: new Date(data.created_at).getTime(),
  };
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
