import React from "react";
import { View, Platform, StyleProp, ViewStyle } from "react-native";

interface MapillaryViewProps {
  latitude: number;
  longitude: number;
  style?: StyleProp<ViewStyle>;
}

const MapillaryView: React.FC<MapillaryViewProps> = ({ latitude, longitude, style }) => {
  const src = `https://www.mapillary.com/app/?lat=${latitude}&lng=${longitude}&z=17&style=light`;

  const containerStyle = [{ overflow: "hidden", backgroundColor: "#F1F5F9" }, style] as any;

  if (Platform.OS === "web") {
    return (
      <View style={containerStyle}>
        <iframe
          src={src}
          style={{ width: "100%", height: "100%", border: 0 }}
          allowFullScreen
          loading="lazy"
          title="Mapillary"
        />
      </View>
    );
  }

  const WebView = require("react-native-webview").WebView;
  return (
    <View style={containerStyle}>
      <WebView
        source={{ uri: src }}
        style={{ flex: 1 }}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        allowsFullscreenVideo
      />
    </View>
  );
};

export default MapillaryView;
