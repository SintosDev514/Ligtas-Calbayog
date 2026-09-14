import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import * as Location from "expo-location";
import { supabase } from "../../../shared/supabase/supabaseClient";

interface LocationData {
  latitude: number;
  longitude: number;
  address: string;
  timestamp?: number;
  accuracy?: number;
}

interface LocationContextType {
  location: LocationData | null;
  isLocating: boolean;
  isLiveLocationActive: boolean;
  getLocation: () => Promise<{ latitude: number; longitude: number } | null>;
  setLocation: (location: LocationData | null) => void;
  toggleLiveLocation: () => void;
  clearLocation: () => void;
}

const LocationContext = createContext<LocationContextType | undefined>(
  undefined,
);

function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const lat = 111320;
  const lng = 111320 * Math.cos((aLat * Math.PI) / 180);
  return Math.sqrt(Math.pow((aLat - bLat) * lat, 2) + Math.pow((aLng - bLng) * lng, 2));
}

function getAccuratePosition(): Promise<Location.LocationObject> {
  return new Promise<Location.LocationObject>((resolve, reject) => {
    let best: { obj: Location.LocationObject; acc: number } | null = null;
    const fixes: { obj: Location.LocationObject; acc: number }[] = [];
    let watchSub: { remove: () => void } | null = null;
    let settled = false;

    const finish = (loc: Location.LocationObject | null, err: any) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { watchSub?.remove(); } catch {}
      if (loc) resolve(loc);
      else reject(err ?? new Error("no location fix"));
    };

    const timer = setTimeout(() => {
      if (best) {
        const cluster = fixes.filter((f) => distanceMeters(f.obj.coords.latitude, f.obj.coords.longitude, best!.obj.coords.latitude, best!.obj.coords.longitude) <= 15);
        if (cluster.length >= 2) {
          let lat = 0, lng = 0, total = 0;
          cluster.forEach((f) => {
            const w = 1 / Math.pow(f.acc || 10, 2);
            lat += f.obj.coords.latitude * w;
            lng += f.obj.coords.longitude * w;
            total += w;
          });
          const loc = cluster[0].obj;
          finish(
            {
              ...loc,
              coords: { ...loc.coords, latitude: lat / total, longitude: lng / total },
            },
            null,
          );
        } else {
          finish(best.obj, null);
        }
      } else {
        finish(null, null);
      }
    }, 10000);

    const takeBest = (obj: Location.LocationObject) => {
      const acc = obj.coords.accuracy ?? Infinity;
      fixes.push({ obj, acc });
      if (!best || acc < best.acc) {
        best = { obj, acc };
      }
      if (acc <= 5) finish(best.obj, null);
    };

    try {
      Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 },
        takeBest,
      )
        .then((sub) => {
          watchSub = sub;
          if (settled) {
            try { sub.remove(); } catch {}
          }
        })
        .catch((e) => finish(null, e));
    } catch (e) {
      finish(null, e);
    }
  });
}

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isLiveLocationActive, setIsLiveLocationActive] = useState(false);
  const liveLocationIntervalRef = useRef<number | null>(null);

  // Get location once
  const getLocation = useCallback(async (): Promise<{ latitude: number; longitude: number } | null> => {
    try {
      setIsLocating(true);

      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        console.log("Location permission denied");
        return null;
      }

      let loc: Location.LocationObject | null = null;
      try {
        loc = await getAccuratePosition();
      } catch (freshErr) {
        const last = await Location.getLastKnownPositionAsync();
        if (last) loc = last;
        else throw freshErr;
      }

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
        accuracy: loc.coords.accuracy ?? undefined,
      });

      return { latitude, longitude };
    } catch (err) {
      console.log("Error getting location:", err);
      return null;
    } finally {
      setIsLocating(false);
    }
  }, []);

  // Persist the live-status flag (and optional coords) so contacts can see it
  const syncLiveStatus = useCallback(
    async (active: boolean, coords?: { latitude: number; longitude: number }) => {
      try {
        const { data } = await supabase.auth.getSession();
        const uid = data?.session?.user?.id;
        if (!uid) return;
        const payload: Record<string, any> = {
          share_live_location: active,
          updated_at: new Date().toISOString(),
        };
        if (coords) {
          payload.latitude = coords.latitude;
          payload.longitude = coords.longitude;
        }
        await supabase.from("resident_profiles").update(payload).eq("id", uid);
      } catch (err) {
        console.log("Failed to sync live status:", err);
      }
    },
    [],
  );

  const getLiveCoords = useCallback(
    async (): Promise<{ latitude: number; longitude: number } | null> => {
      const coords = await getLocation();
      if (coords) {
        syncLiveStatus(true, coords);
      }
      return coords;
    },
    [getLocation, syncLiveStatus],
  );

  // Toggle live location tracking
  const toggleLiveLocation = useCallback(() => {
    const next = !isLiveLocationActive;
    setIsLiveLocationActive(next);
    if (next) {
      syncLiveStatus(true);
    } else {
      syncLiveStatus(false);
    }
  }, [isLiveLocationActive, syncLiveStatus]);

  // Start/stop live location tracking
  useEffect(() => {
    if (isLiveLocationActive) {
      // Get initial location
      getLiveCoords();

      // Update location every 5 seconds
      liveLocationIntervalRef.current = setInterval(() => {
        getLiveCoords();
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
  }, [isLiveLocationActive, getLiveCoords]);

  const clearLocation = useCallback(() => {
    setLocation(null);
    setIsLiveLocationActive(false);
    syncLiveStatus(false);
    if (liveLocationIntervalRef.current) {
      clearInterval(liveLocationIntervalRef.current);
    }
  }, [syncLiveStatus]);

  // Clear any stale "live" flag left from a previous session
  useEffect(() => {
    const clearStaleLive = async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data?.session?.user?.id;
      if (!uid) return;
      supabase
        .from("resident_profiles")
        .update({ share_live_location: false, updated_at: new Date().toISOString() })
        .eq("id", uid)
        .then(() => {});
    };
    clearStaleLive();
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
