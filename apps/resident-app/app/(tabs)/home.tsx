// HomeScreen.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Animated,
  StatusBar,
  Linking,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker, UrlTile } from "@/components/MapView";
import { supabase } from "../../../../shared/supabase/supabaseClient";
import {
  fetchResidentProfile,
  fetchEmergencyContact,
  fetchAnnouncements,
} from "../../../../shared/services/reportService";
import { useLocation } from "../../context/LocationContext";
import { useMapStyle } from "../../context/MapStyleContext";
import { styles } from "./styles/HomeScreen.styles";
import { getUnreadCount, fetchContactLocations } from "../../../../shared/services/messageService";

const { width } = Dimensions.get("window");

const CRIME_CATEGORIES = [
  {
    id: "hit-and-run",
    label: "Hit & Run",
    icon: "car-sport-outline",
    color: "#EF4444",
  },
  { id: "robbery", label: "Robbery", icon: "shield-outline", color: "#F59E0B" },
  { id: "theft", label: "Theft", icon: "bag-remove-outline", color: "#8B5CF6" },
  {
    id: "assault",
    label: "Assault",
    icon: "warning-outline",
    color: "#EC4899",
  },
  {
    id: "vandalism",
    label: "Vandalism",
    icon: "hammer-outline",
    color: "#06B6D4",
  },
  { id: "burglary", label: "Burglary", icon: "home-outline", color: "#10B981" },
];

export default function HomeScreen() {
  const router = useRouter();
  const {
    location,
    isLocating,
    isLiveLocationActive,
    getLocation,
    toggleLiveLocation,
  } = useLocation();
  const { tileUrl, mapStyle, setMapStyle } = useMapStyle();

  const [profile, setProfile] = useState<any>(null);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [policeNumber, setPoliceNumber] = useState<string | null>("23131");
  const [weather, setWeather] = useState<any>(null);
  const [stats, setStats] = useState({ total: 0, pending: 0, resolved: 0 });
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [contactLocations, setContactLocations] = useState<any[]>([]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const liveBadgeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
    getLocation();
    loadData();
  }, []);

  useEffect(() => {
    const channels: any[] = [];
    let cancelled = false;

    const setupRealtime = async () => {
      const { data: session } = await supabase.auth.getSession();
      if (cancelled) return;
      const userId = session?.session?.user?.id;
      if (!userId) return;

      const mainChannel = supabase
        .channel("resident-home-stats")
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "crime_reports", filter: `resident_id=eq.${userId}` },
          () => loadData(),
        )
        .subscribe();
      channels.push(mainChannel);

      const msgChannel = supabase
        .channel("resident-messages")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `receiver_id=eq.${userId}` },
          (payload) => {
            const msg = payload.new as any;
            loadData();
            if (msg?.content) {
              Alert.alert("New Message", msg.content);
            }
          },
        )
        .subscribe();
      channels.push(msgChannel);

      const notifChannel = supabase
        .channel("resident-notifications")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
          () => {
            getUnreadCount(userId).then(setUnreadCount).catch(() => {});
          },
        )
        .subscribe();
      channels.push(notifChannel);

      const annChannel = supabase
        .channel("resident-announcements")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "announcements" },
          (payload) => {
            const ann = payload.new as any;
            loadData();
            if (ann?.title) {
              Alert.alert("New Announcement", ann.title);
            }
          },
        )
        .subscribe();
      channels.push(annChannel);
    };

    setupRealtime();

    return () => {
      cancelled = true;
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, []);

  useEffect(() => {
    if (!isLiveLocationActive) {
      pulseAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isLiveLocationActive, pulseAnim]);

  useEffect(() => {
    if (!isLiveLocationActive) {
      liveBadgeAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(liveBadgeAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(liveBadgeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isLiveLocationActive, liveBadgeAnim]);

  useEffect(() => {
    const fetchWeather = async () => {
      if (!location?.latitude) return;
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current_weather=true&temperature_unit=celsius`,
        );
        const data = await res.json();
        setWeather(data?.current_weather ?? null);
      } catch (err) {
        console.log("weather fetch error", err);
      }
    };
    fetchWeather();
  }, [location]);

  const loadData = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      if (!userId) return;

      const [profileData, reportsData, announcementsData] = await Promise.all([
        fetchResidentProfile(userId),
        supabase
          .from("crime_reports")
          .select("status")
          .eq("resident_id", userId),
        fetchAnnouncements(),
      ]);

      setProfile(profileData);
      const photoField = profileData?.avatar_url || profileData?.id_photo_url;
      if (photoField) {
        const av = photoField;
        if (av.startsWith("http")) {
          setProfilePhoto(av);
        } else {
          const { data: pub } = supabase.storage
            .from("profile-photos")
            .getPublicUrl(av.replace(/^profile-photos\//, ""));
          setProfilePhoto(pub?.publicUrl ?? null);
        }
      }
      setAnnouncements(announcementsData || []);
      const contact = await fetchEmergencyContact("police");
      if (contact?.phone) setPoliceNumber(contact.phone);

      if (reportsData.data) {
      setStats({
        total: reportsData.data.length,
        pending: reportsData.data.filter((r: any) => r.status === "pending")
          .length,
        resolved: reportsData.data.filter((r: any) => r.status === "resolved")
          .length,
      });
    }

    const count = await getUnreadCount(userId);
    setUnreadCount(count);

    const locations = await fetchContactLocations(userId);
    setContactLocations(locations);
  } catch (error) {
    console.log(error);
  }
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Sign out of your account?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace("/(tabs)/login" as any);
        },
      },
    ]);
  };

  const firstName = profile?.full_name?.split(" ")[0] ?? "Resident";
  const lastName = profile?.full_name?.split(" ").pop() ?? "";

  const handleSOS = () => {
    router.push({
      pathname: "/(tabs)/report" as any,
      params: { crimeType: "emergency", isEmergency: "true" },
    });
  };

  const handleProfile = () => router.push("/(tabs)/profile" as any);
  const handleMessages = () => router.push("/(tabs)/messages" as any);
  const handleNotifications = () => router.push("/(tabs)/notifications" as any);
  const handleCallPolice = async () => {
    const url = `tel:${policeNumber ?? "23131"}`;
    const supported = await Linking.canOpenURL(url);
    if (supported) await Linking.openURL(url);
    else
      Alert.alert("Cannot place call", "Your device cannot make phone calls.");
  };

  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Good morning";
    if (hour >= 12 && hour < 17) return "Good afternoon";
    if (hour >= 17 && hour < 21) return "Good evening";
    return "Hello";
  };

  const getWeatherIcon = (code: number | undefined) => {
    if (code === undefined) return "cloud-outline";
    if (code === 0) return "sunny";
    if (code <= 3) return "cloudy";
    if (code <= 67) return "rainy";
    if (code <= 77) return "snow";
    if (code <= 82) return "rainy";
    return "thunderstorm";
  };

  const getWeatherDesc = (code: number | undefined) => {
    if (code === undefined) return "Loading";
    if (code === 0) return "Clear";
    if (code <= 3) return "Partly cloudy";
    if (code <= 67) return "Rain";
    if (code <= 77) return "Snow";
    if (code <= 82) return "Showers";
    return "Storm";
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#17202b" />

      {/* Header */}
      <SafeAreaView edges={["top"]} style={styles.header}>
        <Animated.View
          style={[
            styles.headerContent,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.headerLeft}>
            <View style={styles.logoContainer}>
              <Image
                source={require("../../assets/images/logo-white.png")}
                style={styles.logo}
              />
            </View>

            <View>
              <Text style={styles.headerTitle}>Ligtas Calbayog</Text>

              <Text style={styles.headerSubtitle}>
                Community Safety Platform
              </Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleNotifications}
            >
              <Ionicons name="notifications-outline" size={20} color="rgba(255,255,255,0.7)" />
              {unreadCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleMessages}
            >
              <Ionicons name="mail-outline" size={20} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleProfile}
            >
              <Ionicons name="person-outline" size={20} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Welcome Card */}
        <Animated.View
          style={[
            styles.welcomeCard,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.welcomeTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting}>{getTimeGreeting()}</Text>

              <Text style={styles.userName}>
                {firstName} {lastName}
              </Text>

              <View style={styles.badge}>
                <Ionicons name="shield-checkmark" size={14} color="#1D4ED8" />

                <Text style={styles.badgeText}>Verified Resident</Text>
              </View>
            </View>

            <View style={styles.weatherCard}>
              <Ionicons
                name={getWeatherIcon(weather?.weathercode)}
                size={24}
                color="#2563EB"
              />

              <Text style={styles.weatherTemp}>
                {weather ? `${Math.round(weather.temperature)}°` : "--°"}
              </Text>

              <Text style={styles.weatherLabel}>
                {getWeatherDesc(weather?.weathercode)}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Emergency SOS */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleSOS}
          style={styles.sosContainer}
        >
          <LinearGradient
            colors={["#DC2626", "#B91C1C"]}
            style={styles.sosCard}
          >
            <View style={styles.sosIconContainer}>
              <Ionicons name="warning" size={34} color="#FFFFFF" />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.sosTitle}>Emergency SOS</Text>

              <Text style={styles.sosSubtitle}>
                Immediate police assistance
              </Text>
            </View>

            <Ionicons name="chevron-forward" size={22} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>

        {/* Location Card */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionLabel}>Location Status</Text>

              <Text style={styles.locationText} numberOfLines={1}>
                {location?.address?.split(",")[0] ?? "Fetching location..."}
              </Text>
            </View>

            <Animated.View
              style={[
                styles.statusBadge,
                isLiveLocationActive && styles.statusBadgeActive,
                isLiveLocationActive && { opacity: liveBadgeAnim },
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  isLiveLocationActive && styles.statusBadgeTextActive,
                ]}
              >
                {isLiveLocationActive ? "LIVE" : "OFF"}
              </Text>
            </Animated.View>
          </View>

          <View style={styles.mapContainer}>
            <MapView
              style={styles.map}
              mapType="none"
              mapStyle={mapStyle}
              region={{
                latitude: location?.latitude || 12.066,
                longitude: location?.longitude || 124.6,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
            >
              <UrlTile urlTemplate={tileUrl} />
              {location?.latitude ? (
                <Marker
                  coordinate={{
                    latitude: location.latitude,
                    longitude: location.longitude,
                  }}
                  animated={isLiveLocationActive}
                >
                  <View style={styles.markerWrapper}>
                    <View style={styles.customMarker}>
                      {profilePhoto ? (
                        <Image
                          source={{ uri: profilePhoto }}
                          style={styles.markerPhoto}
                        />
                      ) : (
                        <Ionicons name="person" size={18} color="#F4B51A" />
                      )}
                    </View>
                  </View>
                </Marker>
              ) : null}
              {contactLocations.map((c) => (
                <Marker
                  key={c.id}
                  coordinate={{
                    latitude: c.latitude,
                    longitude: c.longitude,
                  }}
                >
                  <View style={styles.contactMarker}>
                    <Ionicons name="people" size={14} color="#fff" />
                  </View>
                </Marker>
              ))}
            </MapView>
            <View style={styles.mapBtnsRow}>
              <TouchableOpacity
                style={styles.mapStyleBtn}
                onPress={() => setMapStyle(mapStyle === "light" ? "dark" : "light")}
              >
                <Ionicons
                  name={mapStyle === "light" ? "moon-outline" : "sunny-outline"}
                  size={18}
                  color="#fff"
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.expandBtn}
                onPress={() => setMapExpanded(true)}
              >
                <Ionicons name="expand-outline" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.locationButtons}>
            <TouchableOpacity
              style={styles.locationBtn}
              onPress={toggleLiveLocation}
            >
              <Ionicons
                name={
                  isLiveLocationActive ? "radio-button-on" : "radio-button-off"
                }
                size={20}
                color="#2563EB"
              />

              <Text style={styles.locationBtnText}>
                {isLiveLocationActive ? "Stop Sharing" : "Start Sharing"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Report Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Reports</Text>

          <View style={styles.statsRow}>
            <TouchableOpacity
              style={styles.statCard}
              onPress={() => router.push("/(tabs)/my-reports" as any)}
            >
              <Text style={styles.statNumber}>{stats.total}</Text>

              <Text style={styles.statLabel}>Total</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.statCard}
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/my-reports" as any,
                  params: { filter: "pending" },
                })
              }
            >
              <Text style={[styles.statNumber, { color: "#D97706" }]}>
                {stats.pending}
              </Text>

              <Text style={styles.statLabel}>Pending</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.statCard}
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/my-reports" as any,
                  params: { filter: "resolved" },
                })
              }
            >
              <Text style={[styles.statNumber, { color: "#16A34A" }]}>
                {stats.resolved}
              </Text>

              <Text style={styles.statLabel}>Resolved</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Report Categories */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Report Incident</Text>

          <Text style={styles.sectionSubtitle}>Select an incident type</Text>

          <View style={styles.categoriesGrid}>
            {CRIME_CATEGORIES.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={styles.categoryCard}
                activeOpacity={0.85}
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/report" as any,
                    params: {
                      crimeType: category.id,
                      crimeLabel: category.label,
                    },
                  })
                }
              >
                <View style={styles.categoryIcon}>
                  <Ionicons
                    name={category.icon as any}
                    size={24}
                    color="#1D4ED8"
                  />
                </View>

                <Text style={styles.categoryText}>{category.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Announcements Section */}
        {announcements.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Latest Announcements</Text>
              <TouchableOpacity
                onPress={() => router.push("/(tabs)/announcements" as any)}
              >
                <Text style={styles.sectionLink}>View All</Text>
              </TouchableOpacity>
            </View>

            {announcements.slice(0, 3).map((announcement: any) => (
              <TouchableOpacity
                key={announcement.id}
                style={styles.announcementCard}
                activeOpacity={0.7}
              >
                <View style={styles.announcementIcon}>
                  <Ionicons name="megaphone" size={18} color="#1D4ED8" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.announcementTitle} numberOfLines={1}>
                    {announcement.title || "Announcement"}
                  </Text>
                  <Text style={styles.announcementDesc} numberOfLines={2}>
                    {announcement.content ||
                      announcement.message ||
                      "No description"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* MAP MODAL */}
      <Modal
        visible={mapExpanded}
        animationType="slide"
        onRequestClose={() => setMapExpanded(false)}
      >
        <View style={styles.modalContainer}>
          <MapView
            style={styles.fullMap}
            mapType="none"
            mapStyle={mapStyle}
            initialRegion={{
              latitude: location?.latitude ?? 12.066,
              longitude: location?.longitude ?? 124.6,
              latitudeDelta: 0.005,
              longitudeDelta: 0.005,
            }}
          >
            <UrlTile urlTemplate={tileUrl} />
            {location?.latitude && (
              <Marker
                coordinate={{
                  latitude: location.latitude,
                  longitude: location.longitude,
                }}
                animated={isLiveLocationActive}
              >
                <View style={styles.markerWrapper}>
                  <View style={styles.customMarker}>
                    {profilePhoto ? (
                      <Image
                        source={{ uri: profilePhoto }}
                        style={styles.markerPhoto}
                      />
                    ) : (
                      <Ionicons name="person" size={18} color="#F4B51A" />
                    )}
                  </View>
                </View>
              </Marker>
            )}
              {contactLocations.map((c) => (
                <Marker
                  key={c.id}
                  coordinate={{
                    latitude: c.latitude,
                    longitude: c.longitude,
                  }}
                >
                  <View style={styles.contactMarker}>
                    <Ionicons name="people" size={14} color="#fff" />
                  </View>
                </Marker>
              ))}
          </MapView>

          <View style={styles.modalBtnsRow}>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setMapExpanded(false)}
            >
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalStyleBtn}
              onPress={() => setMapStyle(mapStyle === "light" ? "dark" : "light")}
            >
              <Ionicons
                name={mapStyle === "light" ? "moon-outline" : "sunny-outline"}
                size={22}
                color="#fff"
              />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
