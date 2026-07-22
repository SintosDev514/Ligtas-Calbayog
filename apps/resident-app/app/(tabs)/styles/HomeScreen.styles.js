// styles/HomeScreen.styles.ts
import { StyleSheet, Dimensions, Platform } from "react-native";

const { width } = Dimensions.get("window");

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },

  scrollContent: {
    paddingTop: Platform.OS === "ios" ? 115 : 100,
    paddingBottom: 140,
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
    backgroundColor: "#0F204B",
    paddingHorizontal: 0,
    paddingVertical: 0,
    justifyContent: "center",
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
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },

  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  headerNotifBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },

  headerNotifBadge: {
    position: "absolute",
    top: -3,
    right: -3,
    backgroundColor: "#DC2626",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
  },

  headerNotifBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
  },

  logoContainer: {
    justifyContent: "center",
    alignItems: "center",
  },

  logo: {
    width: 36,
    height: 36,
    resizeMode: "contain",
    tintColor: "#FFFFFF",
  },

  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },

  /* ==========================================
       BOTTOM BAR
    ========================================== */

  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 18,
    paddingBottom: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
  },

  bottomBarRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },

  bottomBarItem: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 2,
  },

  bottomBarCenterCircle: {
    position: "absolute",
    top: -26,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#0F204B",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#0F204B",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
  },

  bottomBarCenterRing: {
    position: "absolute",
    top: -30,
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: "#F4B51A",
    backgroundColor: "transparent",
  },

  phoneTipContainer: {
    position: "absolute",
    bottom: 90,
    left: "50%",
    marginLeft: -90,
    alignItems: "center",
    width: 180,
    zIndex: 999,
  },

  phoneTipBubble: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0F204B",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },

  phoneTipText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#EF4444",
  },

  phoneTipDivider: {
    width: 1,
    height: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginHorizontal: 2,
  },

  phoneTipText2: {
    fontSize: 10,
    fontWeight: "600",
    color: "#F4B51A",
  },

  phoneTipArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#0F204B",
  },

  bottomBarLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 1,
    textAlign: "center",
    overflow: "hidden",
  },

  bottomBarBadge: {
    position: "absolute",
    top: 2,
    right: "30%",
    backgroundColor: "#DC2626",
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },

  bottomBarBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
  },

  /* ==========================================
       WELCOME CARD
    ========================================== */

  welcomeCard: {
    marginHorizontal: 20,
    borderRadius: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 6,
    overflow: "hidden",
  },

  welcomeTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },

  welcomeLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },

  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.15)",
  },

  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },

  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#334155",
    justifyContent: "center",
    alignItems: "center",
  },

  greeting: {
    fontSize: 11,
    color: "#94A3B8",
    marginBottom: 2,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  userName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#F4B51A",
    marginBottom: 6,
  },

  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(74,222,128,0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(74,222,128,0.25)",
  },

  badgeText: {
    marginLeft: 4,
    color: "#4ADE80",
    fontWeight: "600",
    fontSize: 9,
  },

  /* ==========================================
       SOS
    ========================================== */

  sosContainer: {
    alignItems: "center",
    justifyContent: "center",
  },

  sosRingWrapper: {
    alignItems: "center",
    justifyContent: "center",
    width: 100,
    height: 100,
  },

  sosRing: {
    position: "absolute",
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 3,
  },
  sosRingIdle: {
    borderColor: "rgba(255,255,255,0.12)",
  },

  sosCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },

  sosCircleText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFFFFF",
    marginTop: 1,
    letterSpacing: 1.5,
  },

  sosHoldHint: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 6,
    letterSpacing: 0.5,
    textAlign: "center",
  },

  sosHoldCounter: {
    fontSize: 9,
    fontWeight: "700",
    color: "rgba(255,255,255,0.6)",
    marginTop: 1,
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
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },

  mapLocationText: {
    fontSize: 11,
    color: "#FFFFFF",
    marginTop: 2,
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
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

  statsSection: {
    marginHorizontal: 20,
    marginBottom: 8,
  },

  statsRow: {
    flexDirection: "row",
    gap: 8,
  },

  weatherCard: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 68,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },

  weatherTemp: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
    marginTop: 4,
  },

  weatherLabel: {
    fontSize: 8,
    fontWeight: "600",
    color: "rgba(255,255,255,0.6)",
    marginTop: 1,
    textAlign: "center",
  },

  weatherDate: {
    fontSize: 9,
    fontWeight: "600",
    color: "rgba(255,255,255,0.4)",
    marginTop: 3,
  },

  combinedStatsCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E8EEF5",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },

  combinedStatsHeader: {
    backgroundColor: "#F8FAFC",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E8EEF5",
  },

  combinedStatsHeaderText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  combinedStatsBody: {
    flexDirection: "row",
  },

  combinedStatItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
  },

  combinedStatNumber: {
    fontSize: 18,
    fontWeight: "800",
    color: "#2563EB",
  },

  combinedStatLabel: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "600",
    marginTop: 3,
  },

  combinedDivider: {
    width: 1,
    backgroundColor: "#E8EEF5",
    alignSelf: "stretch",
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
