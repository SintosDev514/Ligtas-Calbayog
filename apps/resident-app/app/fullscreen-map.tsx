import { View, StyleSheet, StatusBar, TouchableOpacity, Text } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, UrlTile } from "@/components/MapView";
import { useMapStyle } from "@/context/MapStyleContext";
import { SafeAreaView } from "react-native-safe-area-context";

export default function FullscreenMapScreen() {
  const router = useRouter();
  const { latitude, longitude, title } = useLocalSearchParams<{
    latitude: string;
    longitude: string;
    title: string;
  }>();
  const { tileUrl, mapStyle } = useMapStyle();

  const lat = parseFloat(latitude || "0");
  const lng = parseFloat(longitude || "0");

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>{title || "Location"}</Text>
          <View style={styles.placeholder} />
        </View>
      </SafeAreaView>
      <MapView
        style={styles.map}
        mapStyle={mapStyle}
        initialRegion={{
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      >
        <UrlTile urlTemplate={tileUrl} />
        <Marker
          coordinate={{
            latitude: lat,
            longitude: lng,
          }}
        />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  safeArea: { backgroundColor: "rgba(0,0,0,0.8)", position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  title: { fontSize: 16, fontWeight: "600", color: "#fff", flex: 1, textAlign: "center", marginHorizontal: 8 },
  placeholder: { width: 40 },
  map: { flex: 1 },
});
