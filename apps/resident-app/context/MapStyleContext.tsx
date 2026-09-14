import React, { createContext, useContext, useState } from "react";

type MapStyle = "light" | "dark" | "satellite";

// Mapbox Satellite uses the same public access token as the web apps
// (EXPO_PUBLIC_* vars are inlined into the JS bundle at build time). The tile URL
// is always an absolute https:// URL, so the WebView is never given a scheme-less
// path (no file:// / DOMAIN_UNDEFINED error). If no token is configured we fall
// back to Esri World Imagery so the map still renders.
const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
const MAPBOX_SATELLITE_URL = MAPBOX_TOKEN
  ? `https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.png?access_token=${MAPBOX_TOKEN}`
  : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

const TILE_URLS: Record<MapStyle, string> = {
  light: "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
  dark: "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
  satellite: MAPBOX_SATELLITE_URL,
};

interface MapStyleContextType {
  tileUrl: string;
  mapStyle: MapStyle;
  setMapStyle: (style: MapStyle) => void;
}

const MapStyleContext = createContext<MapStyleContextType | undefined>(undefined);

export const MapStyleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mapStyle, setMapStyle] = useState<MapStyle>("satellite");
  return (
    <MapStyleContext.Provider value={{ tileUrl: TILE_URLS[mapStyle], mapStyle, setMapStyle }}>
      {children}
    </MapStyleContext.Provider>
  );
};

export const useMapStyle = () => {
  const ctx = useContext(MapStyleContext);
  if (!ctx) throw new Error("useMapStyle must be used within MapStyleProvider");
  return ctx;
};
