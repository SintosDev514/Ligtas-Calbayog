import React from "react";
import { View, Text, StyleSheet } from "react-native";
import MapView, { Marker, UrlTile } from "./MapView";
import { useMapStyle } from "../context/MapStyleContext";

interface Props {
  latitude: number;
  longitude: number;
  markerColor?: string;
  zoom?: number;
}

export const ReportMapPreview: React.FC<Props> = ({ latitude, longitude, markerColor = "#F4B51A", zoom = 15 }) => {
  const { tileUrl, mapStyle } = useMapStyle();
  const latDelta = 360 / Math.pow(2, zoom);

  const attributionLabel =
    tileUrl.indexOf("api.mapbox.com") > -1
      ? "© Mapbox"
      : tileUrl.indexOf("cartocdn") > -1
        ? "© CARTO · © OpenStreetMap"
        : "© Esri";

  return (
    <View style={styles.map}>
      <MapView
        style={{ flex: 1 }}
        initialRegion={{
          latitude,
          longitude,
          latitudeDelta: latDelta,
          longitudeDelta: latDelta,
        }}
        mapStyle={mapStyle}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        <UrlTile urlTemplate={tileUrl} />
        <Marker coordinate={{ latitude, longitude }} pinColor={markerColor} iconName="location" title="Report location" />
      </MapView>
      <Text style={styles.attribution}>{attributionLabel}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  map: {
    flex: 1,
    backgroundColor: "#E2E8F0",
  },
  attribution: {
    position: "absolute",
    right: 6,
    top: 4,
    fontSize: 9,
    color: "rgba(255,255,255,0.75)",
    backgroundColor: "rgba(0,0,0,0.35)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
});