// styles/HomeScreen.styles.ts
import { StyleSheet, Dimensions, Platform } from "react-native";

const { width } = Dimensions.get("window");

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },

  scrollContent: {
    paddingTop: Platform.OS === "ios" ? 105 : 90,
    paddingBottom: 40,
  },

  /* ==========================================
       HEADER
    ========================================== */

  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    backgroundColor: "#17202b",
    paddingHorizontal: 16,
    paddingBottom: 10,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },

  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  logoContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },

  logo: {
    width: 22,
    height: 22,
    resizeMode: "contain",
    tintColor: "#FFFFFF",
  },

  headerTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },

  headerSubtitle: {
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",
    marginTop: 1,
    fontWeight: "500",
  },

  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },

  notifBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#DC2626",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },

  notifBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },

  /* ==========================================
       WELCOME CARD
    ========================================== */

  welcomeCard: {
    marginHorizontal: 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E8EEF5",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 12,
  },

  welcomeTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  greeting: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 3,
    fontWeight: "500",
  },

  userName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#17202b",
    marginBottom: 8,
  },

  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },

  badgeText: {
    marginLeft: 4,
    color: "#1D4ED8",
    fontWeight: "600",
    fontSize: 10,
  },

  weatherCard: {
    width: 80,
    backgroundColor: "#F5F7FA",
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#E8EEF5",
  },

  weatherTemp: {
    fontSize: 18,
    fontWeight: "700",
    color: "#17202b",
    marginTop: 4,
  },

  weatherLabel: {
    fontSize: 10,
    color: "#64748B",
    marginTop: 2,
  },

  /* ==========================================
       SOS
    ========================================== */

  sosContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
  },

  sosCard: {
    borderRadius: 20,
    padding: 22,
    flexDirection: "row",
    alignItems: "center",
    minHeight: 92,
  },

  sosIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },

  sosTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },

  sosSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
  },

  /* ==========================================
       SECTION CARD
    ========================================== */

  sectionCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },

  mapRow: {
    flexDirection: "row",
    borderRadius: 16,
    overflow: "hidden",
    height: 240,
  },

  mapContainer: {
    flex: 1,
    backgroundColor: "#F0F4F8",
  },

  contactsColumn: {
    width: 72,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingVertical: 10,
    alignItems: "center",
    gap: 8,
    justifyContent: "flex-start",
    overflow: "hidden",
  },

  contactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },

  contactAvatarText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  contactsTitle: {
    fontSize: 9,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },

  map: {
    ...StyleSheet.absoluteFillObject,
  },

  mapTopLeft: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
  },

  mapLocationLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
    textShadowColor: "rgba(0,0,0,0.65)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  mapLocationText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.95)",
    marginTop: 2,
    textShadowColor: "rgba(0,0,0,0.65)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  mapBadge: {
    position: "absolute",
    top: 56,
    left: 12,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },

  statusBadgeActive: {
    backgroundColor: "rgba(46,125,50,0.8)",
  },

  statusBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  statusBadgeTextActive: {
    color: "#FFFFFF",
  },

  mapPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },

  mapBtnsRow: {
    position: "absolute",
    top: 90,
    left: 12,
    flexDirection: "column",
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
    overflow: "hidden",
  },

  mapStyleBtn: {
    width: 34,
    height: 34,
    justifyContent: "center",
    alignItems: "center",
  },

  expandBtn: {
    width: 34,
    height: 34,
    justifyContent: "center",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.15)",
  },

  markerWrapper: {
    width: 48,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
  },

  customMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#17202b",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#22C55E",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    overflow: "hidden",
  },

  markerPhoto: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },

  contactMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#1D4ED8",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },

  contactMapMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#17202b",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    overflow: "hidden",
  },

  contactMapMarkerPhoto: {
    width: 36,
    height: 36,
  },

  contactMapMarkerText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  mapPlaceholderText: {
    marginTop: 10,
    color: "#64748B",
  },

  locationIconBtn: {
    width: 34,
    height: 34,
    justifyContent: "center",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.15)",
  },

  locationBtnText: {
    marginLeft: 8,
    fontWeight: "600",
    color: "#2563EB",
    fontSize: 14,
  },

  /* ==========================================
       SECTION
    ========================================== */

  section: {
    marginHorizontal: 20,
    marginBottom: 26,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#17202b",
    marginBottom: 4,
  },

  sectionSubtitle: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 16,
  },

  /* ==========================================
       STATS
    ========================================== */

  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingVertical: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E8EEF5",
    marginHorizontal: 4,
  },

  statNumber: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1565C0",
    marginBottom: 6,
  },

  statLabel: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "600",
  },

  /* ==========================================
       CATEGORY GRID
    ========================================== */

  categoriesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  categoryCard: {
    width: (width - 52) / 3,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E8EEF5",
    paddingVertical: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },

  categoryIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: "#F5F7FA",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },

  categoryText: {
    textAlign: "center",
    fontWeight: "600",
    fontSize: 13,
    color: "#334155",
  },

  /* ==========================================
       ANNOUNCEMENTS
    ========================================== */

  sectionTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  sectionLink: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1565C0",
  },

  announcementCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E8EEF5",
  },

  announcementIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },

  announcementTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#17202b",
  },

  announcementDesc: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 3,
    lineHeight: 16,
  },

  /* ==========================================
       MODAL
    ========================================== */

  modalContainer: {
    flex: 1,
    backgroundColor: "#000000",
  },

  fullMap: {
    flex: 1,
  },

  modalBtnsRow: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 40,
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  closeBtn: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
  },

  modalStyleBtn: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
  },

  /* ==========================================
       MAP STYLE PICKER
    ========================================== */

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },

  stylePickerModal: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },

  stylePickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },

  stylePickerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#17202b",
  },

  styleOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: "#F5F7FA",
    borderWidth: 1,
    borderColor: "#E8EEF5",
  },

  styleOptionActive: {
    borderColor: "#1565C0",
    backgroundColor: "#EFF6FF",
  },

  styleOptionLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#17202b",
  },

  styleOptionLabelActive: {
    color: "#1565C0",
  },

  styleOptionDesc: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
});
