import { Colors } from "@/constants/Colors";
import { FontFamily } from "@/constants/typography";
import { getRecyclingRules } from "@/services/gemini";
import { getUserLocation } from "@/services/location";
import { getDemoSession, getSession, supabase } from "@/services/supabase";
import {
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts as useManropeFonts,
} from "@expo-google-fonts/manrope";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  useFonts as usePlusJakartaFonts,
} from "@expo-google-fonts/plus-jakarta-sans";
import { Slot, router, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [manropeFontsLoaded] = useManropeFonts({
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  const [jakartaFontsLoaded] = usePlusJakartaFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  const [authResolved, setAuthResolved] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const segments = useSegments();

  const fontsLoaded = manropeFontsLoaded && jakartaFontsLoaded;

  useEffect(() => {
    async function prefetchLocalRecyclingRules() {
      try {
        const location = await getUserLocation();
        const city = location?.city || "General";
        const state = location?.state || "";
        await getRecyclingRules(city, state);
      } catch (error) {
        console.warn("Failed to prefetch recycling rules:", error);
      }
    }

    prefetchLocalRecyclingRules();
  }, []);

  // Resolve initial auth state
  useEffect(() => {
    async function resolveAuth() {
      const session = await getSession();
      const demo = await getDemoSession();
      setIsSignedIn(Boolean(session || demo));
      setAuthResolved(true);
    }

    resolveAuth();

    // Subscribe to Supabase auth changes
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsSignedIn(Boolean(session));
    });

    return () => data.subscription.unsubscribe();
  }, []);

  // Guard navigation once resolved
  useEffect(() => {
    if (!authResolved || !fontsLoaded) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!isSignedIn && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (isSignedIn && inAuthGroup) {
      router.replace("/(tabs)/dashboard");
    }
  }, [authResolved, isSignedIn, fontsLoaded, segments]);

  // Hide splash once everything is ready
  useEffect(() => {
    if (fontsLoaded && authResolved) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, authResolved]);

  if (!fontsLoaded || !authResolved) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashLogo}>VirtuCycle</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <Slot />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  splashLogo: {
    fontFamily: FontFamily.displayBold,
    fontSize: 32,
    color: Colors.primary,
    letterSpacing: -1,
  },
});
