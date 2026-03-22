import {
  getDemoSession,
  getProfile,
  getSession,
  supabase,
  updateProfileSettings,
} from "@/services/supabase";
import type { AccessibilityMode, UserProfile } from "@/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session, User } from "@supabase/supabase-js";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const TTS_KEY = "@virtucycle_tts_enabled";
const AVATAR_KEY = "@virtucycle_avatar_url";

type SessionContextValue = {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  ttsEnabled: boolean;
  toggleTTS: () => void;
  cacheAvatarUrl: (url: string) => void;
  refreshProfile: () => Promise<void>;
  saveProfile: (updates: {
    displayName?: string;
    accessibilityMode?: AccessibilityMode;
  }) => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(TTS_KEY).then((val) => {
      if (val !== null) setTtsEnabled(val === "true");
    });
    AsyncStorage.getItem(AVATAR_KEY).then((val) => {
      if (val) setLocalAvatarUrl(val);
    });
  }, []);

  const toggleTTS = useCallback(() => {
    setTtsEnabled((prev) => {
      const next = !prev;
      AsyncStorage.setItem(TTS_KEY, String(next));
      return next;
    });
  }, []);

  const cacheAvatarUrl = useCallback((url: string) => {
    setLocalAvatarUrl(url);
    AsyncStorage.setItem(AVATAR_KEY, url);
  }, []);

  async function refreshProfile() {
    const currentSession = await getSession();
    const demoProfile = await getDemoSession();

    setSession(currentSession);
    setUser(currentSession?.user ?? null);

    if (!currentSession && demoProfile) {
      setProfile(demoProfile);
      setLoading(false);
      return;
    }

    setProfile(await getProfile(currentSession?.user ?? null));
    setLoading(false);
  }

  async function saveProfile(updates: {
    displayName?: string;
    accessibilityMode?: AccessibilityMode;
  }) {
    const previousProfile = profile;
    const previousUser = user;

    if (profile) {
      setProfile({
        ...profile,
        displayName: updates.displayName ?? profile.displayName,
        accessibilityMode:
          updates.accessibilityMode ?? profile.accessibilityMode,
      });
    }

    try {
      const nextUser = await updateProfileSettings(user, updates);

      if (nextUser) {
        setUser(nextUser);
        setSession((currentSession) =>
          currentSession ? { ...currentSession, user: nextUser } : currentSession,
        );
      }
    } catch (error) {
      setProfile(previousProfile);
      setUser(previousUser ?? null);
      throw error;
    }
  }

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      await refreshProfile();

      if (!active) {
        return;
      }
    }

    bootstrap();

    if (!supabase) {
      return () => {
        active = false;
      };
    }

    const { data } = supabase.auth.onAuthStateChange(
      async (_event, nextSession) => {
        if (!active) {
          return;
        }

        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        setProfile(await getProfile(nextSession?.user ?? null));
        setLoading(false);
      },
    );

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const profileWithAvatar = useMemo(() => {
    if (!profile) return profile;
    const url = localAvatarUrl ?? profile.avatarUrl ?? null;
    return url !== profile.avatarUrl ? { ...profile, avatarUrl: url } : profile;
  }, [profile, localAvatarUrl]);

  const value = useMemo(
    () => ({
      session,
      user,
      profile: profileWithAvatar,
      loading,
      ttsEnabled,
      toggleTTS,
      cacheAvatarUrl,
      refreshProfile,
      saveProfile,
    }),
    [session, user, profileWithAvatar, loading, ttsEnabled, toggleTTS, cacheAvatarUrl],
  );

  return React.createElement(SessionContext.Provider, { value }, children);
}

export function useSession() {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error("useSession must be used inside SessionProvider");
  }

  return context;
}
