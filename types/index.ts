import type { BinType } from "@/constants/bins";

export type AccessibilityMode =
  | "default"
  | "protanopia"
  | "deuteranopia"
  | "tritanopia";

export interface RecyclingRules {
  city: string;
  state: string;
  fetchedAt: number;
  recycling: string[];
  trash: string[];
  compost: string[];
  hazardous: string[];
  notes: string;
  source: "gemini" | "fallback";
}

export interface ScanResult {
  item: string;
  binType: BinType;
  confidence: number;
  explanation: string;
  source: "mlkit" | "gemini" | "claude" | "fallback";
  timestamp: number;
  /** Normalized bounding box (0–1 relative to image dimensions) */
  bounds?: { x: number; y: number; width: number; height: number };
}

export interface RecycledItemRecord {
  id: string;
  userId?: string;
  item: string;
  binType: BinType;
  confidence: number;
  explanation: string;
  source: ScanResult["source"];
  scannedAt: number;
  recycledAt: number;
  impactPoints: number;
  impactCo2Kg: number;
}

export interface QuickTipRecord {
  id: string;
  userId?: string;
  text: string;
  city: string;
  state: string;
  source: "gemini" | "fallback";
  createdAt: number;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  accessibilityMode: AccessibilityMode;
  ecoPoints: number;
  level: number;
  co2SavedKg: number;
  scansThisMonth: number;
  joinedAt: number;
  avatarUrl?: string | null;
}

export interface FriendProfile {
  id: string;
  email: string;
  displayName: string;
  scansThisMonth: number;
  ecoPoints: number;
  level: number;
  co2SavedKg: number;
}

export type FriendRequestStatus = "pending" | "accepted" | "rejected";

export interface FriendRequest {
  id: string;
  senderId: string;
  receiverId: string;
  status: FriendRequestStatus;
  createdAt: number;
  senderProfile?: FriendProfile;
  receiverProfile?: FriendProfile;
}

export interface FriendsData {
  friends: FriendProfile[];
  discoverableUsers: FriendProfile[];
  incomingRequests: FriendRequest[];
  outgoingRequests: FriendRequest[];
}

export interface LeaderboardEntry extends FriendProfile {
  isCurrentUser: boolean;
  rank: number;
}

export interface CollectionSchedule {
  material: string;
  date: string;
  time: string;
  icon: string;
}

export interface AccessibilitySettings {
  enabled: boolean;
  highContrast: boolean;
  largeFonts: boolean;
  autoSpeak: boolean;
  haptics: boolean;
}
