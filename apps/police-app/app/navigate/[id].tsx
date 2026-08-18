import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import MapView, { Marker } from "../../components/MapView";
import { navigateStyles as s } from "../styles/Navigate.styles";
import { openBestStreetView } from "@shared/utils/streetView";

export default function NavigateScreen() {
  const { id, sourceLat, sourceLng, destLat, destLng, name } =
    useLocalSearchParams<{
      id: string;
      sourceLat: string;
      sourceLng: string;
      destLat: string;
      destLng: string;
      name: string;
    }>();
  const router = useRouter();
  const [routeData, setRouteData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [distance, setDistance] = useState<string | null>(null);
  const [duration, setDuration] = useState<string | null>(null);

  const sLat = parseFloat(sourceLat || "0");
  const sLng = parseFloat(sourceLng || "0");
  const dLat = parseFloat(destLat || "0");
  const dLng = parseFloat(destLng || "0");
  const residentName = name || "Resident";

  const fetchRoute = useCallback(async () => {
    if (!sLat || !sLng || !dLat || !dLng) {
      setError("Missing location data.");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const orsUrl = `https://router.project-osrm.org/route/v1/driving/${sLng},${sLat};${dLng},${dLat}?geometries=geojson&overview=full&steps=true`;
      const res = await fetch(orsUrl);
      const json = await res.json();
      if (json.code !== "Ok" || !json.routes?.length) {
        setError("Could not calculate a route to this location.");
        setLoading(false);
        return;
      }
      const route = json.routes[0];
      setRouteData({ geometry: route.geometry });

      const distKm = (route.distance / 1000).toFixed(1);
      const durMin = Math.round(route.duration / 60);
      setDistance(`${distKm} km`);
      setDuration(`${durMin} min`);
    } catch (err) {
      console.error("Route fetch failed:", err);
      setError("Failed to fetch route. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, [sLat, sLng, dLat, dLng]);

  useEffect(() => {
    fetchRoute();
  }, [fetchRoute]);

  const openStreetView = () => {
    openBestStreetView(dLat, dLng, Linking);
  };

  const centerLat = (sLat + dLat) / 2;
  const centerLng = (sLng + dLng) / 2;
  const latDelta = Math.abs(sLat - dLat) * 1.8 || 0.02;
  const lngDelta = Math.abs(sLng - dLng) * 1.8 || 0.02;

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />

      <TouchableOpacity style={s.headerOverlay} onPress={() => router.back()} activeOpacity={0.8}>
        <View style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </View>
        <View style={s.headerInfo}>
          <Text style={s.headerTitle} numberOfLines={1}>{residentName}</Text>
          <Text style={s.headerSub}>Destination</Text>
        </View>
        <View style={s.badge}>
          <Ionicons name="shield-checkmark" size={14} color="#F4B51A" />
          <Text style={s.badgeText}>Route</Text>
        </View>
      </TouchableOpacity>

      {loading ? (
        <View style={s.loadingContainer}>
          <View style={s.loadingMapPlaceholder}>
            <Ionicons name="map-outline" size={64} color="rgba(255,255,255,0.06)" />
          </View>
          <View style={s.loadingCard}>
            <ActivityIndicator size="small" color="#F4B51A" />
            <Text style={s.loadingText}>Calculating route...</Text>
          </View>
        </View>
      ) : error ? (
        <View style={s.errorContainer}>
          <View style={s.errorMapPlaceholder}>
            <Ionicons name="map-outline" size={64} color="rgba(255,255,255,0.06)" />
          </View>
          <View style={s.errorCard}>
            <Ionicons name="alert-circle-outline" size={32} color="#EF4444" />
            <Text style={s.errorText}>{error}</Text>
            <TouchableOpacity style={s.retryBtn} onPress={fetchRoute}>
              <Ionicons name="refresh" size={16} color="#F4B51A" />
              <Text style={s.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          <MapView
            style={s.map}
            initialRegion={{
              latitude: centerLat,
              longitude: centerLng,
              latitudeDelta: Math.max(latDelta, 0.01),
              longitudeDelta: Math.max(lngDelta, 0.01),
            }}
            mapStyle="dark"
            pitch={20}
            routeData={routeData}
            scrollEnabled
            zoomEnabled
          >
            <Marker
              coordinate={{ latitude: sLat, longitude: sLng }}
              pinColor="#3B82F6"
            />
            <Marker
              coordinate={{ latitude: dLat, longitude: dLng }}
              pinColor="#EF4444"
            />
          </MapView>

          <View style={s.bottomPanel}>
            <View style={s.waypointRow}>
              <View style={s.waypointCol}>
                <View style={[s.waypointDot, { backgroundColor: "#3B82F6" }]} />
                <Text style={s.waypointLabel}>From</Text>
                <Text style={s.waypointValue} numberOfLines={1}>Police Station</Text>
              </View>
              <View style={s.waypointLine}>
                <Ionicons name="arrow-forward" size={16} color="rgba(255,255,255,0.2)" />
              </View>
              <View style={s.waypointCol}>
                <View style={[s.waypointDot, { backgroundColor: "#EF4444" }]} />
                <Text style={s.waypointLabel}>To</Text>
                <Text style={s.waypointValue} numberOfLines={1}>{residentName}</Text>
              </View>
            </View>

            <View style={s.statsRow}>
              <View style={s.statCard}>
                <Ionicons name="speedometer-outline" size={18} color="#60A5FA" />
                <Text style={s.statValue}>{distance || "--"}</Text>
                <Text style={s.statLabel}>Distance</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statCard}>
                <Ionicons name="time-outline" size={18} color="#34D399" />
                <Text style={s.statValue}>{duration || "--"}</Text>
                <Text style={s.statLabel}>Est. time</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statCard}>
                <Ionicons name="car-outline" size={18} color="#FBBF24" />
                <Text style={s.statValue}>Driving</Text>
                <Text style={s.statLabel}>Mode</Text>
              </View>
            </View>

            <View style={s.divider} />
            <View style={s.actionRow}>
              <TouchableOpacity
                style={[s.actionBtn, s.actionBtnStreet]}
                onPress={openStreetView}
                activeOpacity={0.8}
              >
                <Ionicons name="eye-outline" size={16} color="#2563EB" />
                <Text style={s.actionBtnTextBlue}>Street View</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.actionBtn, s.actionBtnReport]}
                onPress={() => router.push(`/resident/${id}` as any)}
                activeOpacity={0.8}
              >
                <Ionicons name="document-text-outline" size={16} color="#F4B51A" />
                <Text style={s.actionBtnTextReport}>Report Info</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}
    </View>
  );
}
