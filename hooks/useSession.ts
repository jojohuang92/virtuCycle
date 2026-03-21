import {
    getDemoSession,
    getProfile,
    getSession,
    supabase,
} from "@/services/supabase";
import type { UserProfile } from "@/types";
import type { Session, User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      const currentSession = await getSession();
      const demoProfile = await getDemoSession();

      if (!active) {
        return;
      }

      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setProfile(await getProfile(currentSession?.user ?? null));

      if (!currentSession && demoProfile) {
        setProfile(demoProfile);
      }

      setLoading(false);
    }

    bootstrap();

    if (!supabase) {
      return () => {
        active = false;
      };
    }

    const { data } = supabase.auth.onAuthStateChange(
      async (_event, nextSession) => {
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

  return { session, user, profile, loading };
}
