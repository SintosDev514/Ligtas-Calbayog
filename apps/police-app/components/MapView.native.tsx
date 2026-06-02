import React from "react";
import { View } from "react-native";
import NativeMapView from "react-native-maps";
import { Marker as NativeMarker, UrlTile } from "react-native-maps";

const MapView = React.forwardRef<any, any>(({ style, children, onMarkerPress, ...props }, ref) => (
  <View style={[{ backgroundColor: "#F1F5F9", overflow: "hidden" }, style]}>
    <NativeMapView
      ref={ref}
      style={{ flex: 1 }}
      mapType="none"
      onMarkerPress={(e: any) => onMarkerPress?.(e.nativeEvent)}
      {...props}
    >
      <UrlTile
        urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        tileSize={256}
        maximumZ={19}
        shouldReplaceMapContent
      />
      {children}
    </NativeMapView>
  </View>
));
MapView.displayName = "MapView";

const Marker: React.FC<any> = (props) => <NativeMarker {...props} />;

export default MapView;
export { Marker };
