import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ColorMode = "default" | "protanopia" | "deuteranopia" | "tritanopia";

type AppSettingsContextType = {
  username: string;
  setUsername: (value: string) => void;
  colorMode: ColorMode;
  setColorMode: (value: ColorMode) => void;
  loaded: boolean;
};

const AppSettingsContext = createContext<AppSettingsContextType | undefined>(undefined);

const STORAGE_KEYS = {
  username: "app_username",
  colorMode: "app_color_mode",
};

export function AppSettingsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [username, setUsernameState] = useState("");
  const [colorMode, setColorModeState] = useState<ColorMode>("default");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const savedUsername = await AsyncStorage.getItem(STORAGE_KEYS.username);
        const savedColorMode = await AsyncStorage.getItem(STORAGE_KEYS.colorMode);

        if (savedUsername) setUsernameState(savedUsername);

        if (
          savedColorMode === "default" ||
          savedColorMode === "protanopia" ||
          savedColorMode === "deuteranopia" ||
          savedColorMode === "tritanopia"
        ) {
          setColorModeState(savedColorMode);
        }
      } catch (error) {
        console.log("Error loading settings:", error);
      } finally {
        setLoaded(true);
      }
    }

    loadSettings();
  }, []);

  const setUsername = async (value: string) => {
    setUsernameState(value);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.username, value);
    } catch (error) {
      console.log("Error saving username:", error);
    }
  };

  const setColorMode = async (value: ColorMode) => {
    setColorModeState(value);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.colorMode, value);
    } catch (error) {
      console.log("Error saving color mode:", error);
    }
  };

  return (
    <AppSettingsContext.Provider
      value={{
        username,
        setUsername,
        colorMode,
        setColorMode,
        loaded,
      }}
    >
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  const context = useContext(AppSettingsContext);

  if (!context) {
    throw new Error("useAppSettings must be used inside AppSettingsProvider");
  }

  return context;
}