import React, { createContext, useContext, useState } from "react";

type MapStyle = "light" | "dark" | "satellite";

const TILE_URLS: Record<MapStyle, string> = {
  light: "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
  dark: "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
  satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
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
