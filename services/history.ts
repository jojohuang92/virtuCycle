import type { ScanResult } from "@/types";
import AsyncStorage from "@react-native-async-storage/async-storage";

const HISTORY_KEY = "virtucycle_scan_history";

export async function getScanHistory(): Promise<ScanResult[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as ScanResult[];
    return parsed.sort((left, right) => right.timestamp - left.timestamp);
  } catch {
    return [];
  }
}

export async function saveScanHistory(result: ScanResult): Promise<void> {
  const existing = await getScanHistory();
  const next = [result, ...existing].slice(0, 50);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
}
