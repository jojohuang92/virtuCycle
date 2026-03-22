import { Colors } from "./Colors";

export type BinType =
  | "recycling"
  | "trash"
  | "compost"
  | "hazardous"
  | "unknown";

export const BIN_CONFIG: Record<
  BinType,
  {
    label: string;
    color: string;
    accent: string;
    icon: string;
    hapticPattern: "light" | "medium" | "heavy";
    ttsPrefix: string;
  }
> = {
  recycling: {
    label: "Recycling",
    color: Colors.binYellow,
    accent: Colors.secondaryContainer,
    icon: "refresh-circle-outline",
    hapticPattern: "light",
    ttsPrefix: "Recyclable.",
  },
  trash: {
    label: "Trash",
    color: Colors.binGray,
    accent: Colors.surfaceContainerHigh,
    icon: "trash-outline",
    hapticPattern: "medium",
    ttsPrefix: "Goes in the trash.",
  },
  compost: {
    label: "Compost",
    color: Colors.binGreen,
    accent: "#d5efcf",
    icon: "leaf-outline",
    hapticPattern: "light",
    ttsPrefix: "Compostable.",
  },
  hazardous: {
    label: "Hazardous",
    color: Colors.binRed,
    accent: "#ffe3df",
    icon: "warning-outline",
    hapticPattern: "heavy",
    ttsPrefix: "Hazardous waste.",
  },
  unknown: {
    label: "Check Local Rules",
    color: Colors.outline,
    accent: Colors.surfaceContainerHigh,
    icon: "help-circle-outline",
    hapticPattern: "medium",
    ttsPrefix: "Not sure about this one.",
  },
};
