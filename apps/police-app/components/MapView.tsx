import React from "react";
import { Platform, ViewStyle } from "react-native";

interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

type MapStyle = "light" | "dark" | "street";

interface RouteData {
  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };
}

interface MapViewProps {
  style?: ViewStyle;
  region?: Region;
  initialRegion?: Region;
  children?: React.ReactNode;
  scrollEnabled?: boolean;
  zoomEnabled?: boolean;
  showsUserLocation?: boolean;
  mapStyle?: MapStyle;
  routeData?: RouteData | null;
  pitch?: number;
  bearing?: number;
  userHeading?: number;
  onPress?: (e: any) => void;
  onMarkerPress?: (markerData: any) => void;
  onRegionChangeComplete?: (region: Region) => void;
}

interface MarkerProps {
  coordinate: { latitude: number; longitude: number };
  title?: string;
  pinColor?: string;
  popupHtml?: string;
  markerHtml?: string;
  animate?: boolean;
  heading?: number;
  children?: React.ReactNode;
}

const PlatformMapView: React.FC<MapViewProps> =
  Platform.OS === "web"
    ? require("./MapView.web").default
    : require("./MapView.native").default;

const PlatformMarker: React.FC<MarkerProps> =
  Platform.OS === "web"
    ? require("./MapView.web").Marker
    : require("./MapView.native").Marker;

const MapView: React.FC<MapViewProps> = (props) => <PlatformMapView {...props} />;
MapView.displayName = "MapView";

const Marker: React.FC<MarkerProps> = (props) => <PlatformMarker {...props} />;
Marker.displayName = "Marker";

export default MapView;
export { Marker };
