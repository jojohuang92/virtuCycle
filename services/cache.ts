import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

interface CacheEntry<T> {
  expiresAt: number;
  data: T;
}

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as CacheEntry<T>;
      if (Date.now() > parsed.expiresAt) {
        await AsyncStorage.removeItem(key);
        return null;
      }

      return parsed.data;
    } catch {
      return null;
    }
  },

  async set<T>(key: string, data: T): Promise<void> {
    const entry: CacheEntry<T> = {
      data,
      expiresAt: Date.now() + CACHE_TTL,
    };
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  },

  async clear(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  },
};
