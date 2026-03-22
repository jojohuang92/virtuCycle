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
  source: "mlkit" | "claude" | "fallback";
  timestamp: number;
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
