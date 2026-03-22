import { getColors } from "@/constants/Colors";
import { useSession } from "@/hooks/useSession";
import { useMemo } from "react";

export function useAppTheme() {
  const { profile } = useSession();

  return useMemo(
    () => getColors(profile?.accessibilityMode ?? "default"),
    [profile?.accessibilityMode],
  );
}
