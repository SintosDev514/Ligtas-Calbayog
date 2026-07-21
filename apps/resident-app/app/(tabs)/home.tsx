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
  Vibration,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, UrlTile } from "@/components/MapView";
import { supabase } from "../../../../shared/supabase/supabaseClient";
import {
  fetchResidentProfile,
  fetchEmergencyContact,
  fetchAnnouncements,
  fetchStationSettings,
} from "../../../../shared/services/reportService";
import { useLocation } from "../../context/LocationContext";
import { useMapStyle } from "../../context/MapStyleContext";
import { styles } from "./styles/HomeScreen.styles";
import { getUnreadCount, fetchContactLocations } from "../../../../shared/services/messageService";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
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
  const [policeNumber, setPoliceNumber] = useState<string | null>("117");
  const [stats, setStats] = useState({ total: 0, pending: 0, resolved: 0 });
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [contacts, setContacts] = useState<any[]>([]);
  const [policePosts, setPolicePosts] = useState<any[]>([]);
  const [sosIsHolding, setSosIsHolding] = useState(false);
  const [sosHoldSeconds, setSosHoldSeconds] = useState(5);
  const [weather, setWeather] = useState<any>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const bottomBarAnim = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const isBarVisible = useRef(true);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const liveBadgeAnim = useRef(new Animated.Value(1)).current;
  const sosPulseAnim = useRef(new Animated.Value(1)).current;
  const sosRingAnim = useRef(new Animated.Value(0)).current;

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
    let mounted = true;
    const channels: any[] = [];
    const id = Date.now() + "_" + Math.random().toString(36).slice(2, 8);

    const setupRealtime = async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!mounted) return;
      const userId = session?.session?.user?.id;
      if (!userId) return;

      const mainChannel = supabase
        .channel("rhs-" + id)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "crime_reports", filter: `resident_id=eq.${userId}` },
          () => loadData(),
        )
        .subscribe();
      channels.push(mainChannel);

      const msgChannel = supabase
        .channel("rmsg-" + id)
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
        .channel("rnotif-" + id)
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
        .channel("rann-" + id)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "announcements" },
          () => {
            loadData();
          },
        )
        .subscribe();
      channels.push(annChannel);
    };

    setupRealtime();

    return () => {
      mounted = false;
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

  const weatherCodes: Record<number, { label: string; icon: string }> = {
    0: { label: "Clear", icon: "sunny-outline" },
    1: { label: "Mainly Clear", icon: "sunny-outline" },
    2: { label: "Partly Cloudy", icon: "partly-sunny-outline" },
    3: { label: "Overcast", icon: "cloud-outline" },
    45: { label: "Foggy", icon: "cloud-outline" },
    48: { label: "Foggy", icon: "cloud-outline" },
    51: { label: "Drizzle", icon: "rainy-outline" },
    53: { label: "Drizzle", icon: "rainy-outline" },
    55: { label: "Drizzle", icon: "rainy-outline" },
    61: { label: "Rain", icon: "rainy-outline" },
    63: { label: "Rain", icon: "rainy-outline" },
    65: { label: "Rain", icon: "rainy-outline" },
    71: { label: "Snow", icon: "snow-outline" },
    73: { label: "Snow", icon: "snow-outline" },
    75: { label: "Snow", icon: "snow-outline" },
    80: { label: "Rain Showers", icon: "rainy-outline" },
    81: { label: "Rain Showers", icon: "rainy-outline" },
    82: { label: "Rain Showers", icon: "rainy-outline" },
    95: { label: "Thunderstorm", icon: "thunderstorm-outline" },
    96: { label: "Thunderstorm", icon: "thunderstorm-outline" },
    99: { label: "Thunderstorm", icon: "thunderstorm-outline" },
  };

  useEffect(() => {
    if (!location?.latitude) return;
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current_weather=true&timezone=auto`
    )
      .then((r) => r.json())
      .then((data) => setWeather(data.current_weather))
      .catch(() => {});
  }, [location?.latitude, location?.longitude]);

  const getWeatherInfo = () => {
    if (!weather) return { label: "", icon: "partly-sunny-outline" as any, temp: "" };
    const info = weatherCodes[weather.weathercode] || { label: "Unknown", icon: "cloud-outline" };
    return { ...info, temp: `${Math.round(weather.temperature)}°` };
  };

  const sosRingColor = sosRingAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(255,255,255,0.2)", "#EF4444"],
  });
  const sosRingScale = sosRingAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.12],
  });

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(sosPulseAnim, {
          toValue: 1.08,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(sosPulseAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [sosPulseAnim]);

  useEffect(() => {
    const listener = sosRingAnim.addListener(({ value }) => {
      const remaining = Math.ceil(5 - value * 5);
      setSosHoldSeconds(Math.max(0, remaining));
    });
    return () => sosRingAnim.removeListener(listener);
  }, []);

  let sosHoldAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  const handleSosPressIn = () => {
    setSosIsHolding(true);
    sosRingAnim.setValue(0);
    sosHoldAnimRef.current = Animated.timing(sosRingAnim, {
      toValue: 1,
      duration: 5000,
      useNativeDriver: false,
    });
    sosHoldAnimRef.current.start(({ finished }) => {
      if (finished) {
        Vibration.vibrate(200);
        setSosIsHolding(false);
        router.push("/emergency-report" as any);
      }
    });
  };

  const handleSosPressOut = () => {
    if (!sosIsHolding) return;
    setSosIsHolding(false);
    if (sosHoldAnimRef.current) {
      sosHoldAnimRef.current.stop();
    }
    Animated.timing(sosRingAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const loadData = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      if (!userId) return;

      const [profileData, reportsData, announcementsData, postsData] = await Promise.all([
        fetchResidentProfile(userId),
        supabase
          .from("crime_reports")
          .select("status")
          .eq("resident_id", userId),
        fetchAnnouncements(),
        supabase.from("police_posts").select("*").order("name"),
      ]);

      const posts = postsData.data || [];
      const postIds = posts.map((p: any) => p.id);
      const officerMap: Record<string, string[]> = {};
      if (postIds.length > 0) {
        const { data: assignments } = await supabase
          .from("police_post_assignments")
          .select("post_id, officer_id")
          .in("post_id", postIds);
        const officerIds = [...new Set((assignments ?? []).map((a: any) => a.officer_id))];
        if (officerIds.length > 0) {
          const { data: officers } = await supabase
            .from("police_profiles")
            .select("id, full_name, rank")
            .in("id", officerIds);
          const officerNames: Record<string, string> = {};
          for (const o of officers ?? []) {
            officerNames[o.id] = `${o.full_name} (${o.rank})`;
          }
          for (const a of assignments ?? []) {
            if (!officerMap[a.post_id]) officerMap[a.post_id] = [];
            if (officerNames[a.officer_id]) officerMap[a.post_id].push(officerNames[a.officer_id]);
          }
        }
      }
      setPolicePosts(posts.map((p: any) => ({ ...p, officers: officerMap[p.id] || [] })));

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
      const stationSettings = await fetchStationSettings().catch(() => null);
      if (stationSettings?.police_phone) setPoliceNumber(stationSettings.police_phone);

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

    const { data: familyData } = await supabase
      .from("family_contacts")
      .select("id, name, phone_number, relationship, contact_user_id")
      .eq("user_id", userId);
    const locatedIds = new Set(locations.map((l: any) => l.id));
    const contactUserIds = (familyData || [])
      .map((c: any) => c.contact_user_id)
      .filter(Boolean);
    let photoMap: Record<string, string> = {};
    if (contactUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from("resident_profiles")
        .select("id, avatar_url, id_photo_url")
        .in("id", contactUserIds);
      for (const p of (profiles || [])) {
        const photo = p.avatar_url || p.id_photo_url;
        if (photo) {
          const url = photo.startsWith("http")
            ? photo
            : supabase.storage.from("profile-photos").getPublicUrl(photo.replace(/^profile-photos\//, "")).data?.publicUrl || null;
          if (url) photoMap[p.id] = url;
        }
      }
    }
    const allContacts = (familyData || []).map((c: any) => ({
      ...c,
      hasLocation: locatedIds.has(c.id),
      location: locations.find((l: any) => l.id === c.id),
      photoUrl: photoMap[c.contact_user_id] || null,
    }));
    setContacts(allContacts);
  } catch (error) {
    console.log(error);
  }
  };

  const cycleMapStyle = () => {
    const order = ["light", "dark", "satellite"];
    const idx = order.indexOf(mapStyle);
    setMapStyle(order[(idx + 1) % order.length]);
  };

  const getMapStyleIcon = () => {
    if (mapStyle === "light") return "sunny-outline";
    if (mapStyle === "dark") return "moon-outline";
    return "globe-outline";
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Sign out of your account?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.removeItem("@ligtas_login_timestamp");
          await supabase.auth.signOut();
          router.replace("/(tabs)/login" as any);
        },
      },
    ]);
  };

  const firstName = profile?.full_name?.split(" ")[0] ?? "Resident";
  const lastName = profile?.full_name?.split(" ").pop() ?? "";

  const handleProfile = () => router.push("/(tabs)/profile" as any);
  const handleMessages = () => router.push("/(tabs)/messages" as any);
  const handleNotifications = () => router.push("/(tabs)/notifications" as any);
  const handleReport = () => router.push("/(tabs)/report-picker" as any);
  const handleAnnouncements = () => router.push("/(tabs)/announcements" as any);
  const handleCallPolice = async () => {
    const url = `tel:${policeNumber ?? "117"}`;
    const supported = await Linking.canOpenURL(url);
    if (supported) await Linking.openURL(url);
    else
      Alert.alert("Cannot place call", "Your device cannot make phone calls.");
  };

  const handleScroll = (event: any) => {
    const currentY = event.nativeEvent.contentOffset.y;
    if (currentY > lastScrollY.current && isBarVisible.current && currentY > 20) {
      isBarVisible.current = false;
      Animated.timing(bottomBarAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    } else if (currentY < lastScrollY.current && !isBarVisible.current) {
      isBarVisible.current = true;
      Animated.timing(bottomBarAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
    lastScrollY.current = currentY;
  };

  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Good morning";
    if (hour >= 12 && hour < 17) return "Good afternoon";
    if (hour >= 17 && hour < 21) return "Good evening";
    return "Hello";
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1e293b" />

      {/* Header */}
      <SafeAreaView edges={["top"]} style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <View style={styles.logoContainer}>
              <Image
                source={require("../../assets/images/logo-white.png")}
                style={styles.logo}
              />
            </View>
            <Text style={styles.headerTitle}>Ligtas Calbayog</Text>
          </View>
          <TouchableOpacity style={styles.headerNotifBtn} onPress={handleNotifications}>
            <Ionicons name="notifications-outline" size={20} color="rgba(255,255,255,0.7)" />
            {unreadCount > 0 && (
              <View style={styles.headerNotifBadge}>
                <Text style={styles.headerNotifBadgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onScroll={handleScroll}
        scrollEventThrottle={16}
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
          <LinearGradient
            colors={["#1e293b", "#0f172a"]}
            style={styles.welcomeTopRow}
          >
            <View style={styles.welcomeLeft}>
              <View style={styles.avatarContainer}>
                {profilePhoto ? (
                  <Image source={{ uri: profilePhoto }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="person" size={22} color="#94A3B8" />
                  </View>
                )}
              </View>

              <View>
                <Text style={styles.greeting}>{getTimeGreeting()}</Text>

                <Text style={styles.userName} numberOfLines={1}>
                  {firstName} {lastName}
                </Text>

                <View style={styles.badge}>
                  <Ionicons name="shield-checkmark" size={10} color="#4ADE80" />
                  <Text style={styles.badgeText}>Verified</Text>
                </View>
              </View>
            </View>

            <View style={styles.sosContainer}>
              <View style={styles.sosRingWrapper}>
                <Animated.View
                  style={[
                    styles.sosRing,
                    {
                      borderColor: sosRingColor,
                      transform: [{ scale: sosRingScale }],
                    },
                    !sosIsHolding && styles.sosRingIdle,
                  ]}
                />
                <TouchableOpacity
                  activeOpacity={1}
                  onPressIn={handleSosPressIn}
                  onPressOut={handleSosPressOut}
                >
                  <Animated.View style={{ transform: [{ scale: sosPulseAnim }] }}>
                    <LinearGradient
                      colors={sosIsHolding ? ["#DC2626", "#991B1B"] : ["#DC2626", "#B91C1C"]}
                      style={styles.sosCircle}
                    >
                      <Ionicons name="warning" size={24} color="#FFFFFF" />
                      <Text style={styles.sosCircleText}>SOS</Text>
                      {sosIsHolding && (
                        <Text style={styles.sosHoldCounter}>{sosHoldSeconds}</Text>
                      )}
                    </LinearGradient>
                  </Animated.View>
                </TouchableOpacity>
              </View>
              <Text style={styles.sosHoldHint}>Hold 5s to report</Text>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Report Stats */}
        <View style={styles.statsSection}>
          <View style={styles.statsRow}>
            <LinearGradient
              colors={["#1e293b", "#0f172a"]}
              style={styles.weatherCard}
            >
              <Ionicons name={getWeatherInfo().icon} size={18} color="#FFFFFF" />
              <Text style={styles.weatherTemp}>{getWeatherInfo().temp}</Text>
              <Text style={styles.weatherLabel}>{getWeatherInfo().label}</Text>
              <Text style={styles.weatherDate}>
                {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </Text>
            </LinearGradient>

            <TouchableOpacity style={styles.combinedStatsCard} activeOpacity={0.8}
              onPress={() => router.push("/(tabs)/my-reports" as any)}
            >
              <View style={styles.combinedStatsHeader}>
                <Text style={styles.combinedStatsHeaderText}>My Reports</Text>
              </View>
              <View style={styles.combinedStatsBody}>
                <View style={styles.combinedStatItem}>
                  <Text style={styles.combinedStatNumber}>{stats.total}</Text>
                  <Text style={styles.combinedStatLabel}>Total</Text>
                </View>
                <View style={styles.combinedDivider} />
                <View style={styles.combinedStatItem}>
                  <Text style={[styles.combinedStatNumber, { color: "#D97706" }]}>{stats.pending}</Text>
                  <Text style={styles.combinedStatLabel}>Pending</Text>
                </View>
                <View style={styles.combinedDivider} />
                <View style={styles.combinedStatItem}>
                  <Text style={[styles.combinedStatNumber, { color: "#16A34A" }]}>{stats.resolved}</Text>
                  <Text style={styles.combinedStatLabel}>Resolved</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Location Card - Map Integrated */}
        <View style={styles.sectionCard}>
          <View style={styles.mapRow}>
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
                onMarkerPress={(e: any) => {
                  const coord = e?.coordinate || e?.nativeEvent?.coordinate;
                  if (!coord) return;
                  const post = policePosts.find(
                    (p: any) =>
                      Math.abs(p.latitude - coord.latitude) < 0.001 &&
                      Math.abs(p.longitude - coord.longitude) < 0.001,
                  );
                  if (post) {
                    const officers = post.officers?.length
                      ? post.officers.join("\n")
                      : "No officers assigned";
                    Alert.alert(post.name, `Patrol Officers:\n${officers}`);
                  }
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
                {contacts.filter((c: any) => c.hasLocation && c.location?.latitude).map((c: any) => {
                  const isActive = c.location?.updated_at
                    ? Date.now() - new Date(c.location.updated_at).getTime() < 3600000
                    : false;
                  const colors = ["#1D4ED8", "#DC2626", "#D97706", "#059669", "#7C3AED", "#DB2777", "#0891B2"];
                  const colorIdx = c.id ? c.id.toString().length % colors.length : 0;
                  return (
                    <Marker
                      key={c.id}
                      coordinate={{
                        latitude: c.location.latitude,
                        longitude: c.location.longitude,
                      }}
                    >
                      <View style={[styles.contactMapMarker, {
                        borderColor: isActive ? "#22C55E" : "#CBD5E1",
                      }]}>
                        {c.photoUrl ? (
                          <Image source={{ uri: c.photoUrl }} style={styles.contactMapMarkerPhoto} />
                        ) : (
                          <Text style={styles.contactMapMarkerText}>{c.name?.[0]?.toUpperCase() || "?"}</Text>
                        )}
                      </View>
                    </Marker>
                  );
                })}
                {policePosts.map((post) => {
                  const officerText = post.officers?.length
                    ? `\n\nPatrol Officers:\n• ${post.officers.join("\n• ")}`
                    : "\n\nNo officers assigned";
                  return (
                    <Marker
                      key={`post-${post.id}`}
                      coordinate={{ latitude: post.latitude, longitude: post.longitude }}
                      iconName="post-pin"
                      title={`${post.name}${officerText}`}
                    />
                  );
                })}
              </MapView>

              {/* Location Status Overlay */}
              <View style={styles.mapTopLeft}>
                <Text style={styles.mapLocationLabel}>Location Status</Text>
                <Text style={styles.mapLocationText} numberOfLines={1}>
                  {location?.address?.split(",")[0] ?? "Fetching location..."}
                </Text>
              </View>

              <Animated.View
                style={[
                  styles.mapBadge,
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

              <View style={styles.mapBtnsRow}>
                <TouchableOpacity
                  style={styles.mapStyleBtn}
                  onPress={cycleMapStyle}
                >
                  <Ionicons
                    name={getMapStyleIcon()}
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
                <TouchableOpacity
                  style={styles.locationIconBtn}
                  onPress={toggleLiveLocation}
                >
                  <Ionicons
                    name={isLiveLocationActive ? "radio-button-on" : "radio-button-off"}
                    size={18}
                    color={isLiveLocationActive ? "#4ADE80" : "#fff"}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Contacts Column */}
            <View style={styles.contactsColumn}>
              <Text style={styles.contactsTitle}>Active</Text>
              {contacts.length > 0 ? (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {contacts.slice(0, 5).map((c: any) => {
                    const initials = c.name
                      ?.split(" ")
                      .map((n: string) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2) || "?";
                    const colors = ["#1D4ED8", "#DC2626", "#D97706", "#059669", "#7C3AED", "#DB2777", "#0891B2"];
                    const colorIdx = c.id ? c.id.toString().length % colors.length : 0;
                    const isActive = c.hasLocation && c.location?.updated_at
                      ? Date.now() - new Date(c.location.updated_at).getTime() < 3600000
                      : false;
                    return (
                      <TouchableOpacity
                        key={c.id}
                        activeOpacity={0.7}
                        onPress={() =>
                          router.push({
                            pathname: "/(tabs)/chat",
                            params: {
                              id: c.id,
                              name: c.name,
                              phone: c.phone_number || "",
                              relationship: c.relationship || "",
                              contact_user_id: c.contact_user_id || "",
                            },
                          })
                        }
                      >
                        <View style={[styles.contactAvatar, {
                          backgroundColor: c.photoUrl ? "transparent" : colors[colorIdx],
                          borderWidth: 3,
                          borderColor: isActive ? "#22C55E" : "#CBD5E1",
                          overflow: "hidden",
                        }]}>
                          {c.photoUrl ? (
                            <Image source={{ uri: c.photoUrl }} style={{ width: 40, height: 40 }} />
                          ) : (
                            <Text style={styles.contactAvatarText}>{initials}</Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              ) : (
                <View style={[styles.contactAvatar, { backgroundColor: "#E8EEF5" }]}>
                  <Ionicons name="people-outline" size={18} color="#94A3B8" />
                </View>
              )}
            </View>
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
                onPress={() => router.push("/(tabs)/announcements" as any)}
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
                  {(announcement.image_url || announcement.video_url) && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                      {announcement.image_url && (
                        <Text style={{ fontSize: 11, color: "#3B82F6" }}>📷 Photo</Text>
                      )}
                      {announcement.video_url && (
                        <Text style={{ fontSize: 11, color: "#DC2626" }}>🎬 Video</Text>
                      )}
                      {announcement.latitude && (
                        <Text style={{ fontSize: 11, color: "#059669" }}>📍 Location</Text>
                      )}
                    </View>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Bottom Bar */}
      <Animated.View
        style={[
          styles.bottomBar,
          {
            paddingBottom: 8 + insets.bottom,
            transform: [{
              translateY: bottomBarAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 150],
              }),
            }],
          },
        ]}
      >
        <TouchableOpacity style={styles.bottomBarItem} onPress={handleReport}>
          <Ionicons name="add-circle-outline" size={24} color="#DC2626" />
          <Text style={styles.bottomBarLabel}>Report</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomBarItem} onPress={handleMessages}>
          <Ionicons name="chatbubbles-outline" size={22} color="#64748B" />
          <Text style={styles.bottomBarLabel}>Messages</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomBarItem} onPress={handleAnnouncements}>
          <Ionicons name="megaphone-outline" size={22} color="#64748B" />
          <Text style={styles.bottomBarLabel}>Announcements</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomBarItem} onPress={handleProfile}>
          <Ionicons name="person-outline" size={22} color="#64748B" />
          <Text style={styles.bottomBarLabel}>Profile</Text>
        </TouchableOpacity>
      </Animated.View>

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
            onMarkerPress={(e: any) => {
              const coord = e?.coordinate || e?.nativeEvent?.coordinate;
              if (!coord) return;
              const post = policePosts.find(
                (p: any) =>
                  Math.abs(p.latitude - coord.latitude) < 0.001 &&
                  Math.abs(p.longitude - coord.longitude) < 0.001,
              );
              if (post) {
                const officers = post.officers?.length
                  ? post.officers.join("\n")
                  : "No officers assigned";
                Alert.alert(post.name, `Patrol Officers:\n${officers}`);
              }
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
              {contacts.filter((c: any) => c.hasLocation && c.location?.latitude).map((c: any) => {
                const isActive = c.location?.updated_at
                  ? Date.now() - new Date(c.location.updated_at).getTime() < 3600000
                  : false;
                const colors = ["#1D4ED8", "#DC2626", "#D97706", "#059669", "#7C3AED", "#DB2777", "#0891B2"];
                const colorIdx = c.id ? c.id.toString().length % colors.length : 0;
                return (
                  <Marker
                    key={c.id}
                    coordinate={{
                      latitude: c.location.latitude,
                      longitude: c.location.longitude,
                    }}
                  >
                    <View style={[styles.contactMapMarker, {
                      borderColor: isActive ? "#22C55E" : "#CBD5E1",
                    }]}>
                      {c.photoUrl ? (
                        <Image source={{ uri: c.photoUrl }} style={styles.contactMapMarkerPhoto} />
                      ) : (
                        <Text style={styles.contactMapMarkerText}>{c.name?.[0]?.toUpperCase() || "?"}</Text>
                      )}
                    </View>
                  </Marker>
                );
              })}
              {policePosts.map((post) => {
                const officerText = post.officers?.length
                  ? `\n\nPatrol Officers:\n• ${post.officers.join("\n• ")}`
                  : "\n\nNo officers assigned";
                return (
                  <Marker
                    key={`modal-post-${post.id}`}
                    coordinate={{ latitude: post.latitude, longitude: post.longitude }}
                    iconName="post-pin"
                    title={`${post.name}${officerText}`}
                  />
                );
              })}
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
              onPress={cycleMapStyle}
            >
              <Ionicons
                name={getMapStyleIcon()}
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
