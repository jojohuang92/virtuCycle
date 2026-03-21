import type { AccessibilitySettings } from "@/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

const STORAGE_KEY = "virtucycle_accessibility";

const DEFAULT_SETTINGS: AccessibilitySettings = {
  enabled: false,
  highContrast: false,
  largeFonts: false,
  autoSpeak: true,
  haptics: true,
};

export function useAccessibility() {
  const [settings, setSettings] =
    useState<AccessibilitySettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          setSettings({
            ...DEFAULT_SETTINGS,
            ...(JSON.parse(raw) as Partial<AccessibilitySettings>),
          });
        }
      })
      .finally(() => setReady(true));
  }, []);

  const updateSettings = async (next: Partial<AccessibilitySettings>) => {
    const merged = { ...settings, ...next };
    setSettings(merged);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  };

  return { settings, updateSettings, ready };
}
