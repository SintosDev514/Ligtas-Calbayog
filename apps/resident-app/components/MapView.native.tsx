import React from "react";
import { Platform, View } from "react-native";
import NativeMapView from "react-native-maps";
import { Marker, Polyline as NativePolyline, UrlTile as NativeUrlTile } from "react-native-maps";

const MAP_BG: Record<string, string> = {
  light: "#F1F5F9",
  dark: "#1F2937",
};

const NativeMapViewWrapper = React.forwardRef<any, any>(({ style, mapStyle, ...props }, ref) => (
  <View style={[{ backgroundColor: MAP_BG[mapStyle as string] || MAP_BG.light, overflow: "hidden" }, style]}>
    <NativeMapView ref={ref} style={{ flex: 1 }} {...props} />
  </View>
));
NativeMapViewWrapper.displayName = "MapView";

export default NativeMapViewWrapper;
export { Marker, NativePolyline as Polyline };

interface UrlTileProps {
  urlTemplate: string;
  tileSize?: number;
  maximumZ?: number;
  minimumZ?: number;
  zIndex?: number;
  shouldReplaceMapContent?: boolean;
  doubleTileSize?: boolean;
  opacity?: number;
  flipY?: boolean;
  maximumNativeZ?: number;
  offlineMode?: boolean;
  tileCacheMaxAge?: number;
  tileCachePath?: string;
}

const StyledUrlTile: React.FC<UrlTileProps> = ({
  urlTemplate,
  tileSize = 256,
  maximumZ = 19,
  minimumZ = 1,
  shouldReplaceMapContent = Platform.OS === "ios",
  doubleTileSize = Platform.OS === "android",
  tileCacheMaxAge = 86400,
  ...rest
}) => (
  <NativeUrlTile
    urlTemplate={urlTemplate}
    tileSize={tileSize}
    maximumZ={maximumZ}
    minimumZ={minimumZ}
    shouldReplaceMapContent={shouldReplaceMapContent}
    doubleTileSize={doubleTileSize}
    tileCacheMaxAge={tileCacheMaxAge}
    {...rest}
  />
);

export { StyledUrlTile as UrlTile };
