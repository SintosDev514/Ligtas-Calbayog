import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import * as Location from "expo-location";

interface LocationData {
  latitude: number;
  longitude: number;
  address: string;
  timestamp?: number;
}

interface LocationContextType {
  location: LocationData | null;
  isLocating: boolean;
  isLiveLocationActive: boolean;
  getLocation: () => Promise<void>;
  setLocation: (location: LocationData | null) => void;
  toggleLiveLocation: () => void;
  clearLocation: () => void;
}

const LocationContext = createContext<LocationContextType | undefined>(
  undefined,
);

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isLiveLocationActive, setIsLiveLocationActive] = useState(false);
  const liveLocationIntervalRef = useRef<number | null>(null);

  // Get location once
  const getLocation = useCallback(async () => {
    try {
      setIsLocating(true);

      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        console.log("Location permission denied");
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude } = loc.coords;
      let address = "Current Location";

      try {
        const geo = await Location.reverseGeocodeAsync({
          latitude,
          longitude,
        });

        if (geo.length > 0) {
          const g = geo[0];
          address = [g.street, g.district, g.city, g.region]
            .filter(Boolean)
            .join(", ");
        }
      } catch {}

      setLocation({
        latitude,
        longitude,
        address,
        timestamp: Date.now(),
      });
    } catch (err) {
      console.log("Error getting location:", err);
    } finally {
      setIsLocating(false);
    }
  }, []);

  // Toggle live location tracking
  const toggleLiveLocation = useCallback(() => {
    setIsLiveLocationActive((prev) => !prev);
  }, []);

  // Start/stop live location tracking
  useEffect(() => {
    if (isLiveLocationActive) {
      // Get initial location
      getLocation();

      // Update location every 5 seconds
      liveLocationIntervalRef.current = setInterval(() => {
        getLocation();
      }, 5000);
    } else {
      // Clear interval when live location is turned off
      if (liveLocationIntervalRef.current) {
        clearInterval(liveLocationIntervalRef.current);
        liveLocationIntervalRef.current = null;
      }
    }

    return () => {
      if (liveLocationIntervalRef.current) {
        clearInterval(liveLocationIntervalRef.current);
      }
    };
  }, [isLiveLocationActive, getLocation]);

  const clearLocation = useCallback(() => {
    setLocation(null);
    setIsLiveLocationActive(false);
    if (liveLocationIntervalRef.current) {
      clearInterval(liveLocationIntervalRef.current);
    }
  }, []);

  const value: LocationContextType = {
    location,
    isLocating,
    isLiveLocationActive,
    getLocation,
    setLocation,
    toggleLiveLocation,
    clearLocation,
  };

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error("useLocation must be used within LocationProvider");
  }
  return context;
};
