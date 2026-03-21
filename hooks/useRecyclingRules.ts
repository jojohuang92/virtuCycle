import { getRecyclingRules } from "@/services/gemini";
import { getUserLocation } from "@/services/location";
import type { RecyclingRules } from "@/types";
import { useEffect, useState } from "react";

export function useRecyclingRules() {
  const [rules, setRules] = useState<RecyclingRules | null>(null);
  const [loading, setLoading] = useState(true);
  const [city, setCity] = useState("General");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        const location = await getUserLocation();
        const nextCity = location?.city || "General";
        const nextState = location?.state || "";
        const nextRules = await getRecyclingRules(nextCity, nextState);

        if (!active) {
          return;
        }

        setCity(nextCity);
        setRules(nextRules);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load local recycling rules.",
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  return { rules, loading, city, error };
}
