import React from "react";
import { View } from "react-native";
import MapView, { UrlTile } from "./MapView";
import { useMapStyle } from "../context/MapStyleContext";

const CALBAYOG = {
  latitude: 12.069,
  longitude: 124.601,
};

const WARMERS = [
  { latitude: CALBAYOG.latitude, longitude: CALBAYOG.longitude, latitudeDelta: 0.12, longitudeDelta: 0.14 },
  { latitude: CALBAYOG.latitude, longitude: CALBAYOG.longitude, latitudeDelta: 0.012, longitudeDelta: 0.012 },
  { latitude: CALBAYOG.latitude - 0.05, longitude: CALBAYOG.longitude - 0.05, latitudeDelta: 0.012, longitudeDelta: 0.012 },
  { latitude: CALBAYOG.latitude + 0.05, longitude: CALBAYOG.longitude + 0.05, latitudeDelta: 0.012, longitudeDelta: 0.012 },
];

export const MapTileWarmer: React.FC = () => {
  const { tileUrl } = useMapStyle();
  if (!tileUrl) return null;

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: -20000,
        left: 0,
        width: 2000,
        height: 800,
        opacity: 0,
      }}
    >
      {WARMERS.map((cfg, idx) => (
        <View
          key={idx}
          style={{
            position: "absolute",
            top: idx * 15,
            left: idx * 15,
            width: 420,
            height: 420,
            overflow: "hidden",
          }}
        >
          <MapView
            initialRegion={{
              latitude: cfg.latitude,
              longitude: cfg.longitude,
              latitudeDelta: cfg.latitudeDelta,
              longitudeDelta: cfg.longitudeDelta,
            }}
            scrollEnabled={false}
            zoomEnabled={false}
          >
            <UrlTile urlTemplate={tileUrl} />
          </MapView>
        </View>
      ))}
    </View>
  );
};