import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Animated,
  StatusBar,
  ActivityIndicator,
  Image,
  Linking,
  Dimensions,
  ScrollView,
  Platform,
  Modal,
  Alert,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  fetchAnnouncements,
  toggleAnnouncementLike,
  fetchBatchAnnouncementLikes,
  addAnnouncementComment,
  fetchAnnouncementComments,
} from "../../../../shared/services/reportService";
import { supabase } from "../../../../shared/supabase/supabaseClient";
import { fetchContacts, sendMessage } from "../../../../shared/services/messageService";
import { getCached, setCache } from "../../../../shared/services/cacheService";
import MapView, { Marker, UrlTile } from "@/components/MapView";
import { useMapStyle } from "@/context/MapStyleContext";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const LIST_PAD = 16;
const CARD_WIDTH = SCREEN_WIDTH - LIST_PAD * 2;

const CATEGORY_META: Record<string, { bg: string; text: string; accent: string; icon: string; label: string }> = {
  advisory: { bg: "#EFF6FF", text: "#1D4ED8", accent: "#3B82F6", icon: "information-circle", label: "Advisory" },
  alert: { bg: "#FEF2F2", text: "#DC2626", accent: "#EF4444", icon: "warning", label: "Alert" },
  news: { bg: "#ECFDF5", text: "#059669", accent: "#10B981", icon: "newspaper", label: "News" },
  event: { bg: "#F5F3FF", text: "#7C3AED", accent: "#8B5CF6", icon: "calendar", label: "Event" },
  default: { bg: "#F8FAFC", text: "#475569", accent: "#64748B", icon: "megaphone", label: "General" },
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-PH", {
    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function timeAgo(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return formatDate(dateStr);
}

function getImages(item: any): string[] {
  if (item.image_urls && Array.isArray(item.image_urls) && item.image_urls.length > 0) return item.image_urls;
  if (item.image_url) return [item.image_url];
  return [];
}

function getVideos(item: any): string[] {
  if (item.video_urls && Array.isArray(item.video_urls) && item.video_urls.length > 0) return item.video_urls;
  if (item.video_url) return [item.video_url];
  return [];
}

function ImageGallery({ images, onPressImage }: { images: string[]; onPressImage: (url: string) => void }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  return (
    <View style={imgGal.wrapper}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / CARD_WIDTH);
          setActiveIndex(idx);
        }}
      >
        {images.map((url, i) => (
          <TouchableOpacity
            key={i}
            activeOpacity={0.95}
            onPress={() => onPressImage(url)}
          >
            <Image source={{ uri: url }} style={imgGal.image} resizeMode="cover" />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {images.length > 1 ? (
        <>
          <View style={imgGal.dotsRow}>
            {images.map((_, i) => (
              <View
                key={i}
                style={[
                  imgGal.dot,
                  { backgroundColor: activeIndex === i ? "#FFFFFF" : "rgba(255,255,255,0.4)" },
                ]}
              />
            ))}
          </View>
          <View style={imgGal.countBadge}>
            <Ionicons name="images-outline" size={10} color="#fff" />
            <Text style={imgGal.countText}>{activeIndex + 1}/{images.length}</Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

const imgGal = StyleSheet.create({
  wrapper: { backgroundColor: "#E2E8F0" },
  image: { width: CARD_WIDTH, height: 210 },
  dotsRow: {
    flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 5,
    position: "absolute", bottom: 10, left: 0, right: 0,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  countBadge: {
    position: "absolute", top: 10, right: 10,
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20,
  },
  countText: { color: "#fff", fontSize: 11, fontWeight: "700" },
});

function VideoList({ videos }: { videos: string[] }) {
  return (
    <View style={vidGal.wrapper}>
      {videos.map((url, i) => {
        const isYoutube = url.includes("youtube.com") || url.includes("youtu.be");
        return (
          <TouchableOpacity
            key={i}
            style={vidGal.item}
            onPress={() => Linking.openURL(url).catch(() => {})}
            activeOpacity={0.7}
          >
            <View style={vidGal.thumb}>
              <Ionicons name="play" size={18} color="#fff" />
            </View>
            <View style={vidGal.info}>
              <Text style={vidGal.title} numberOfLines={1}>
                {videos.length > 1 ? `Video ${i + 1}` : "Watch Video"}
              </Text>
              <Text style={vidGal.source}>{isYoutube ? "YouTube" : "Video Link"}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const vidGal = StyleSheet.create({
  wrapper: { gap: 8 },
  item: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 12, backgroundColor: "#F8F8F8",
    borderTopWidth: 1, borderTopColor: "#F0F0F0",
  },
  thumb: {
    width: 36, height: 36, borderRadius: 6,
    backgroundColor: "#DC2626", justifyContent: "center", alignItems: "center",
  },
  info: { flex: 1 },
  title: { fontSize: 13, fontWeight: "600", color: "#1E293B" },
  source: { fontSize: 11, color: "#94A3B8", marginTop: 1 },
});

function LocationMap({
  latitude,
  longitude,
  locationName,
  onPress,
}: {
  latitude: number;
  longitude: number;
  locationName?: string;
  onPress: () => void;
}) {
  const { tileUrl, mapStyle } = useMapStyle();

  return (
    <TouchableOpacity style={locMap.container} onPress={onPress} activeOpacity={0.9}>
      <MapView
        style={locMap.map}
        mapType="none"
        mapStyle={mapStyle}
        region={{
          latitude, longitude,
          latitudeDelta: 0.008, longitudeDelta: 0.008,
        }}
        zoomEnabled={false} scrollEnabled={false} rotateEnabled={false} pitchEnabled={false}
      >
        <UrlTile urlTemplate={tileUrl} />
        <Marker coordinate={{ latitude, longitude }}>
          <View style={locMap.marker}>
            <View style={locMap.markerInner}>
              <Ionicons name="location" size={14} color="#fff" />
            </View>
          </View>
        </Marker>
      </MapView>
      <View style={locMap.overlay}>
        <Ionicons name="location" size={12} color="#F4B51A" />
        <Text style={locMap.overlayText} numberOfLines={1}>
          {locationName || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`}
        </Text>
        <View style={locMap.expandBtn}>
          <Ionicons name="expand-outline" size={12} color="#fff" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const locMap = StyleSheet.create({
  container: { height: 170 },
  map: { flex: 1 },
  marker: { alignItems: "center" },
  markerInner: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "#DC2626", justifyContent: "center", alignItems: "center",
    borderWidth: 2.5, borderColor: "#fff",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 4,
  },
  overlay: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingVertical: 8, paddingHorizontal: 12,
    backgroundColor: "rgba(15,32,75,0.85)",
  },
  overlayText: { fontSize: 11, color: "#fff", fontWeight: "600", flex: 1 },
  expandBtn: {
    width: 22, height: 22, borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center", alignItems: "center",
  },
});

async function fetchBarangay(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=en`,
      { headers: { "User-Agent": "LigtasCalbayog/1.0" } }
    );
    const data = await res.json();
    const addr = data?.address;
    return addr?.barangay || addr?.suburb || addr?.town || addr?.village || addr?.municipality || null;
  } catch {
    return null;
  }
}

function AnnouncementCard({
  item,
  index,
  fadeAnim,
  onOpenMap,
  onShare,
  onLike,
  onComment,
  liked,
  likesCount,
  commentsCount,
}: {
  item: any;
  index: number;
  fadeAnim: Animated.Value;
  onOpenMap: () => void;
  onShare: () => void;
  onLike: () => void;
  onComment: () => void;
  liked: boolean;
  likesCount: number;
  commentsCount: number;
}) {
  const catKey = item.category?.toLowerCase() || "default";
  const meta = CATEGORY_META[catKey] ?? CATEGORY_META.default;
  const images = getImages(item);
  const videos = getVideos(item);
  const hasLocation = item.latitude && item.longitude;
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  return (
    <Animated.View
      style={[
        cardStyles.outer,
        {
          opacity: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
          transform: [{
            translateY: fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [20 * Math.min(index + 1, 5), 0],
            }),
          }],
        },
      ]}
    >
      <View style={cardStyles.header}>
        <View style={cardStyles.avatar}>
          <Ionicons name="shield-checkmark" size={20} color="#fff" />
        </View>
        <View style={cardStyles.headerInfo}>
          <View style={cardStyles.nameRow}>
            <Text style={cardStyles.pageName}>PNP Calbayog</Text>
            <View style={[cardStyles.badge, { backgroundColor: meta.bg }]}>
              <Ionicons name={meta.icon as any} size={8} color={meta.text} />
              <Text style={[cardStyles.badgeText, { color: meta.text }]}>{meta.label}</Text>
            </View>
          </View>
          <Text style={cardStyles.timestamp}>{timeAgo(item.created_at)}</Text>
        </View>
      </View>

      <View style={cardStyles.contentArea}>
        <Text style={cardStyles.title}>{item.title}</Text>
        <Text style={cardStyles.content}>{item.content ?? item.body ?? ""}</Text>
      </View>

      {images.length > 0 ? (
        <View style={cardStyles.mediaWrap}>
          <ImageGallery images={images} onPressImage={setFullscreenImage} />
        </View>
      ) : null}

      {videos.length > 0 ? (
        <View style={cardStyles.mediaWrap}>
          <VideoList videos={videos} />
        </View>
      ) : null}

      <View style={cardStyles.statsBar}>
        {images.length > 0 || videos.length > 0 || hasLocation ? (
          <Text style={cardStyles.statsText}>
            {images.length > 0 ? `${images.length} photo${images.length > 1 ? "s" : ""}` : null}
            {images.length > 0 && videos.length > 0 ? " · " : null}
            {videos.length > 0 ? `${videos.length} video${videos.length > 1 ? "s" : ""}` : null}
            {(images.length > 0 || videos.length > 0) && hasLocation ? " · " : null}
            {hasLocation ? "1 location" : null}
          </Text>
        ) : null}
      </View>

      <View style={cardStyles.actions}>
        <TouchableOpacity style={cardStyles.actionBtn} activeOpacity={0.6} onPress={onLike}>
          <Ionicons name={liked ? "heart" : "heart-outline"} size={18} color={liked ? "#EF4444" : "#64748B"} />
          <Text style={[cardStyles.actionText, liked ? { color: "#EF4444" } : null]}>{likesCount > 0 ? likesCount : "Like"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={cardStyles.actionBtn} activeOpacity={0.6} onPress={onComment}>
          <Ionicons name="chatbubble-outline" size={18} color="#64748B" />
          <Text style={cardStyles.actionText}>{commentsCount > 0 ? commentsCount : "Comment"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={cardStyles.actionBtn} activeOpacity={0.6} onPress={onShare}>
          <Ionicons name="paper-plane-outline" size={18} color="#64748B" />
          <Text style={cardStyles.actionText}>Share</Text>
        </TouchableOpacity>
        {hasLocation ? (
          <TouchableOpacity style={cardStyles.actionBtn} activeOpacity={0.6} onPress={onOpenMap}>
            <Ionicons name="location-outline" size={18} color="#EF4444" />
            <Text style={[cardStyles.actionText, { color: "#EF4444" }]}>Map</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <Modal visible={!!fullscreenImage} transparent onRequestClose={() => setFullscreenImage(null)}>
        <TouchableOpacity style={cardStyles.fullscreenOverlay} activeOpacity={1} onPress={() => setFullscreenImage(null)}>
          {fullscreenImage ? (
            <Image source={{ uri: fullscreenImage }} style={cardStyles.fullscreenImage} resizeMode="contain" />
          ) : null}
          <TouchableOpacity style={cardStyles.fullscreenClose} onPress={() => setFullscreenImage(null)}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </Animated.View>
  );
}

const cardStyles = StyleSheet.create({
  outer: {
    backgroundColor: "#fff",
    borderRadius: 10,
    marginTop: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    overflow: "hidden",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  avatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "#0F204B",
    justifyContent: "center", alignItems: "center",
  },
  headerInfo: { flex: 1, marginLeft: 10 },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pageName: { fontSize: 13, fontWeight: "700", color: "#1E293B" },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10,
  },
  badgeText: { fontSize: 8, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.3 },
  timestamp: { fontSize: 11, color: "#94A3B8", marginTop: 1 },

  contentArea: { paddingHorizontal: 14, paddingBottom: 12 },
  title: {
    fontSize: 16, fontWeight: "700", color: "#0F204B",
    marginBottom: 6, lineHeight: 21,
  },
  content: {
    fontSize: 13.5, color: "#334155", lineHeight: 20,
  },

  mediaWrap: { borderTopWidth: 1, borderTopColor: "#F0F0F0" },

  statsBar: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: "#F0F0F0",
  },
  statsText: { fontSize: 12, color: "#94A3B8", fontWeight: "500" },

  actions: {
    flexDirection: "row",
    borderTopWidth: 1, borderTopColor: "#F0F0F0",
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
  },
  actionText: { fontSize: 12, fontWeight: "600", color: "#64748B" },

  fullscreenOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  fullscreenImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  fullscreenClose: {
    position: "absolute",
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
});

export default function AnnouncementsScreen() {
  const router = useRouter();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [shareItem, setShareItem] = useState<any>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [likesMap, setLikesMap] = useState<Record<string, { liked: boolean; count: number }>>({});
  const [commentItem, setCommentItem] = useState<any>(null);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [sendingComment, setSendingComment] = useState(false);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    loadAnnouncements();

    const channelName = `announcements-${Date.now()}`;
    const channel = supabase.channel(channelName);
    channel.on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, () => loadAnnouncements());
    channel.subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadAnnouncements = async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError("");

    const cached = await getCached("announcements");
    if (cached) {
      setAnnouncements(cached.data);
      if (!isRefresh) {
        setIsLoading(false);
      }
    }

    try {
      const data = await fetchAnnouncements();
      const withBrgy = await Promise.all(
        (data ?? []).map(async (item: any) => {
          if (item.latitude && item.longitude && !item.location_name) {
            const brgy = await fetchBarangay(item.latitude, item.longitude);
            if (brgy) item.location_name = brgy;
          }
          return item;
        })
      );
      setAnnouncements(withBrgy);
      setCache("announcements", withBrgy);

      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      const ids = withBrgy.map((a: any) => a.id);
      if (ids.length > 0) {
        const likes = await fetchBatchAnnouncementLikes(ids, userId);
        setLikesMap(likes);
      }

      if (!cached) {
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
      }
    } catch (e: any) {
      if (!cached) {
        setError(e.message || "Failed to load announcements.");
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = useCallback(() => loadAnnouncements(true), []);

  const handleShare = async (item: any) => {
    setShareItem(item);
    setShowShareModal(true);
    setLoadingContacts(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const user = session?.session?.user;
      if (!user) return;
      const data = await fetchContacts(user.id);
      setContacts(data);
    } catch {
      setContacts([]);
    } finally {
      setLoadingContacts(false);
    }
  };

  const handleSendToContact = async (contact: any) => {
    if (!shareItem) return;
    setSharing(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const user = session?.session?.user;
      if (!user) return;

      const announcementText = `ANN_ID:${shareItem.id}\n\n${shareItem.title}\n\n${shareItem.content ?? shareItem.body ?? ""}`;
      await sendMessage(user.id, contact.id, {
        content: announcementText,
        type: "announcement",
        receiverId: contact.contact_user_id || undefined,
      });
      setShowShareModal(false);
      setShareItem(null);
      Alert.alert("Shared", `Announcement sent to ${contact.name}`);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to share announcement");
    } finally {
      setSharing(false);
    }
  };

  const handleLike = async (item: any) => {
    const { data: session } = await supabase.auth.getSession();
    const user = session?.session?.user;
    if (!user) return;

    const prev = likesMap[item.id];
    setLikesMap((m) => ({
      ...m,
      [item.id]: { liked: !prev?.liked, count: (prev?.count ?? 0) + (prev?.liked ? -1 : 1) },
    }));

    try {
      await toggleAnnouncementLike(item.id, user.id);
    } catch {
      setLikesMap((m) => ({
        ...m,
        [item.id]: prev ?? { liked: false, count: 0 },
      }));
    }
  };

  const handleComment = async (item: any) => {
    setCommentItem(item);
    setShowCommentModal(true);
    setCommentText("");
    setLoadingComments(true);
    try {
      const data = await fetchAnnouncementComments(item.id);
      setComments(data);
    } catch {
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleSendComment = async () => {
    if (!commentText.trim() || !commentItem) return;
    setSendingComment(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const user = session?.session?.user;
      if (!user) return;
      const newComment = await addAnnouncementComment(commentItem.id, user.id, commentText.trim());
      setComments((prev) => [...prev, newComment]);
      setCommentText("");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to send comment");
    } finally {
      setSendingComment(false);
    }
  };

  const renderItem = ({ item, index }: { item: any; index: number }) => (
    <AnnouncementCard
      item={item}
      index={index}
      fadeAnim={fadeAnim}
      onOpenMap={() =>
        router.push({
          pathname: "/fullscreen-map",
          params: {
            latitude: item.latitude?.toString() ?? "",
            longitude: item.longitude?.toString() ?? "",
            title: item.location_name || "Location",
          },
        })
      }
      onShare={() => handleShare(item)}
      onLike={() => handleLike(item)}
      onComment={() => handleComment(item)}
      liked={likesMap[item.id]?.liked ?? false}
      likesCount={likesMap[item.id]?.count ?? 0}
      commentsCount={0}
    />
  );

  const renderEmpty = () => (
    <View style={styles.center}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="megaphone-outline" size={36} color="#94A3B8" />
      </View>
      <Text style={styles.emptyTitle}>No Announcements Yet</Text>
      <Text style={styles.emptyText}>Check back later for news and advisories from PNP Calbayog.</Text>
    </View>
  );

  const renderError = () => (
    <View style={styles.center}>
      <View style={styles.errorIconWrap}>
        <Ionicons name="cloud-offline-outline" size={36} color="#EF4444" />
      </View>
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity style={styles.retryBtn} onPress={() => loadAnnouncements()} activeOpacity={0.8}>
        <Ionicons name="refresh" size={14} color="#fff" style={{ marginRight: 5 }} />
        <Text style={styles.retryText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );

  const renderLoading = () => (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#17202b" />
      <Text style={styles.loadingText}>Loading announcements...</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F204B" />
      <SafeAreaView edges={["top"]} style={styles.headerSafe}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
              <Ionicons name="chevron-back" size={20} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Announcements</Text>
              <Text style={styles.headerSub}>PNP Calbayog Police Station</Text>
            </View>
            <TouchableOpacity onPress={handleRefresh} style={styles.headerBtn}>
              <Ionicons name="refresh" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {isLoading ? renderLoading() : error ? renderError() : (
        <FlatList
          data={announcements}
          keyExtractor={(item) => item.id?.toString()}
          renderItem={renderItem}
          contentContainerStyle={announcements.length === 0 ? styles.emptyList : styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor="#0F204B"
              colors={["#0F204B"]}
              progressBackgroundColor="#fff"
            />
          }
          ListEmptyComponent={renderEmpty}
          />
        )}

      <Modal visible={showShareModal} transparent animationType="slide" onRequestClose={() => setShowShareModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Share to Contact</Text>
              <TouchableOpacity onPress={() => { setShowShareModal(false); setShareItem(null); }}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            {shareItem ? (
              <View style={styles.sharePreview}>
                <Text style={styles.sharePreviewTitle} numberOfLines={2}>{shareItem.title}</Text>
              </View>
            ) : null}

            {loadingContacts ? (
              <View style={styles.modalCenter}>
                <ActivityIndicator size="large" color="#17202b" />
                <Text style={styles.loadingText}>Loading contacts...</Text>
              </View>
            ) : contacts.length === 0 ? (
              <View style={styles.modalCenter}>
                <Ionicons name="people-outline" size={40} color="#94A3B8" />
                <Text style={styles.emptyTitle}>No Contacts</Text>
                <Text style={styles.emptyText}>Add contacts in Messages to share announcements.</Text>
              </View>
            ) : (
              <ScrollView style={styles.contactList}>
                {contacts.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={styles.contactItem}
                    onPress={() => handleSendToContact(c)}
                    disabled={sharing}
                  >
                    <View style={styles.contactAvatar}>
                      <Text style={styles.contactAvatarText}>
                        {(c.name || "?").charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.contactInfo}>
                      <Text style={styles.contactName}>{c.name}</Text>
                      <Text style={styles.contactRel}>{c.relationship || "Contact"}</Text>
                    </View>
                    <Ionicons name="paper-plane" size={18} color="#3B82F6" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {sharing ? (
              <View style={styles.sharingOverlay}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.sharingText}>Sending...</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal visible={showCommentModal} transparent animationType="slide" onRequestClose={() => setShowCommentModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "80%" }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Comments</Text>
              <TouchableOpacity onPress={() => { setShowCommentModal(false); setCommentItem(null); }}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            {commentItem ? (
              <View style={styles.sharePreview}>
                <Text style={styles.sharePreviewTitle} numberOfLines={2}>{commentItem.title}</Text>
              </View>
            ) : null}

            {loadingComments ? (
              <View style={styles.modalCenter}>
                <ActivityIndicator size="large" color="#17202b" />
                <Text style={styles.loadingText}>Loading comments...</Text>
              </View>
            ) : comments.length === 0 ? (
              <View style={styles.modalCenter}>
                <Ionicons name="chatbubbles-outline" size={40} color="#94A3B8" />
                <Text style={styles.emptyTitle}>No Comments Yet</Text>
                <Text style={styles.emptyText}>Be the first to comment on this announcement.</Text>
              </View>
            ) : (
              <ScrollView style={styles.contactList}>
                {comments.map((c) => (
                  <View key={c.id} style={styles.commentItem}>
                    <View style={styles.commentAvatar}>
                      <Text style={styles.commentAvatarText}>
                        {(c.resident?.full_name || "?").charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.commentBody}>
                      <Text style={styles.commentAuthor}>{c.resident?.full_name || "Unknown"}</Text>
                      <Text style={styles.commentContent}>{c.content}</Text>
                      <Text style={styles.commentTime}>{timeAgo(c.created_at)}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}

            <View style={styles.commentInputRow}>
              <TextInput
                style={styles.commentInput}
                placeholder="Write a comment..."
                placeholderTextColor="#94A3B8"
                value={commentText}
                onChangeText={setCommentText}
                multiline={false}
              />
              <TouchableOpacity
                style={[styles.commentSendBtn, !commentText.trim() && { opacity: 0.4 }]}
                onPress={handleSendComment}
                disabled={!commentText.trim() || sendingComment}
              >
                {sendingComment ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="send" size={16} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },

  headerSafe: { backgroundColor: "#0F204B" },
  header: {
    borderBottomWidth: 1, borderBottomColor: "rgba(244,181,26,0.2)",
    shadowColor: "#000", shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
  headerRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingVertical: 12,
  },
  headerCenter: { alignItems: "center", flex: 1 },
  headerTitle: { color: "#F4B51A", fontSize: 17, fontWeight: "800", letterSpacing: 0.3 },
  headerSub: { color: "rgba(255,255,255,0.5)", fontSize: 10, marginTop: 1, fontWeight: "500" },
  headerBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center", alignItems: "center",
  },

  listContent: { padding: 16, paddingBottom: 40 },
  emptyList: { flexGrow: 1 },

  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  loadingText: { marginTop: 12, color: "#64748B", fontSize: 13, fontWeight: "500" },

  errorIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: "#FEF2F2", justifyContent: "center", alignItems: "center", marginBottom: 4,
  },
  errorText: { color: "#EF4444", fontSize: 13, textAlign: "center", marginTop: 10, lineHeight: 18 },
  retryBtn: {
    marginTop: 18, backgroundColor: "#0F204B",
    paddingHorizontal: 22, paddingVertical: 10, borderRadius: 10,
    flexDirection: "row", alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 6, elevation: 3,
  },
  retryText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0",
    justifyContent: "center", alignItems: "center", marginBottom: 4,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#0F204B", marginTop: 14 },
  emptyText: { fontSize: 13, color: "#64748B", textAlign: "center", marginTop: 6, lineHeight: 18, paddingHorizontal: 20 },

  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: "80%", paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: "#F0F0F0",
  },
  modalTitle: { fontSize: 16, fontWeight: "700", color: "#0F204B" },
  sharePreview: {
    marginHorizontal: 20, marginTop: 12,
    padding: 12, backgroundColor: "#F8FAFC", borderRadius: 10,
    borderWidth: 1, borderColor: "#E2E8F0",
  },
  sharePreviewTitle: { fontSize: 13, fontWeight: "600", color: "#334155" },
  modalCenter: {
    padding: 40, alignItems: "center", justifyContent: "center",
  },
  contactList: { paddingHorizontal: 20, marginTop: 8 },
  contactItem: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F1F5F9",
  },
  contactAvatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: "#0F204B", justifyContent: "center", alignItems: "center",
  },
  contactAvatarText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  contactInfo: { flex: 1, marginLeft: 12 },
  contactName: { fontSize: 14, fontWeight: "600", color: "#1E293B" },
  contactRel: { fontSize: 12, color: "#94A3B8", marginTop: 1 },
  sharingOverlay: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    padding: 14, backgroundColor: "#0F204B", marginHorizontal: 20, borderRadius: 10, marginTop: 12,
  },
  sharingText: { color: "#fff", fontSize: 13, fontWeight: "600" },

  commentItem: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  commentAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#0F204B",
    justifyContent: "center", alignItems: "center",
  },
  commentAvatarText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  commentBody: { flex: 1 },
  commentAuthor: { fontSize: 12, fontWeight: "700", color: "#1E293B" },
  commentContent: { fontSize: 13, color: "#334155", marginTop: 2, lineHeight: 18 },
  commentTime: { fontSize: 10, color: "#94A3B8", marginTop: 4 },
  commentInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  commentInput: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 13,
    color: "#1E293B",
  },
  commentSendBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "#0F204B",
    justifyContent: "center", alignItems: "center",
  },
});
