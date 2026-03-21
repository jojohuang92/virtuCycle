import * as Location from "expo-location";

export interface UserLocation {
  city: string;
  state: string;
  country: string;
  lat: number;
  lng: number;
}

export async function getUserLocation(): Promise<UserLocation | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      return null;
    }

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const [geo] = await Location.reverseGeocodeAsync({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    });

    return {
      city: geo?.city || "General",
      state: geo?.region || "",
      country: geo?.country || "",
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    };
  } catch (error) {
    console.error("Location error:", error);
    return null;
  }
}
