import type { QuickTipRecord, RecycledItemRecord, ScanResult } from "@/types";
import AsyncStorage from "@react-native-async-storage/async-storage";

const HISTORY_KEY = "virtucycle_scan_history";
const RECYCLED_HISTORY_KEY = "virtucycle_recycled_history";
const QUICK_TIPS_HISTORY_KEY = "virtucycle_quick_tips";

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

function getRecycledHistoryKey(userId?: string) {
  return userId ? `${RECYCLED_HISTORY_KEY}:${userId}` : RECYCLED_HISTORY_KEY;
}

export async function getRecycledHistory(
  userId?: string,
): Promise<RecycledItemRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(getRecycledHistoryKey(userId));
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as RecycledItemRecord[];
    return parsed.sort((left, right) => right.recycledAt - left.recycledAt);
  } catch {
    return [];
  }
}

export async function saveRecycledHistory(
  record: RecycledItemRecord,
): Promise<void> {
  const existing = await getRecycledHistory(record.userId);
  const next = [record, ...existing].slice(0, 250);
  await AsyncStorage.setItem(
    getRecycledHistoryKey(record.userId),
    JSON.stringify(next),
  );
}

function getQuickTipsHistoryKey(userId?: string) {
  return userId
    ? `${QUICK_TIPS_HISTORY_KEY}:${userId}`
    : QUICK_TIPS_HISTORY_KEY;
}

export async function getQuickTipsHistory(
  userId?: string,
): Promise<QuickTipRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(getQuickTipsHistoryKey(userId));
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as QuickTipRecord[];
    return parsed.sort((left, right) => right.createdAt - left.createdAt);
  } catch {
    return [];
  }
}

export async function saveQuickTipHistory(
  record: QuickTipRecord,
): Promise<void> {
  const existing = await getQuickTipsHistory(record.userId);
  const next = [record, ...existing].slice(0, 250);
  await AsyncStorage.setItem(
    getQuickTipsHistoryKey(record.userId),
    JSON.stringify(next),
  );
}
