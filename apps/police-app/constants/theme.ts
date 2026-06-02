export const colors = {
  primary: "#17202b",
  primaryLight: "#1e2a36",
  primaryDark: "#0f141a",
  accent: "#F4B51A",
  accentLight: "#f7cc4d",
  background: "#F8FAFC",
  surface: "#FFFFFF",
  border: "#E2E8F0",
  borderLight: "#F1F5F9",
  text: "#0F172A",
  textSecondary: "#475569",
  textTertiary: "#94A3B8",
  textMuted: "#CBD5E1",
  success: "#10B981",
  successLight: "#D1FAE5",
  warning: "#F59E0B",
  warningLight: "#FEF3C7",
  error: "#EF4444",
  errorLight: "#FEE2E2",
  info: "#3B82F6",
  infoLight: "#DBEAFE",
  purple: "#8B5CF6",
  purpleLight: "#EDE9FE",
  white: "#FFFFFF",
  black: "#000000",
  overlay: "rgba(0,0,0,0.5)",
  headerBg: "#17202b",
  tabBarBg: "#17202b",
  cardShadow: "#000",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const borderRadius = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 14,
  xxl: 16,
  round: 999,
};

export const fontSize = {
  xs: 10,
  sm: 11,
  md: 12,
  base: 13,
  lg: 14,
  xl: 15,
  xxl: 17,
  title: 20,
  heading: 24,
};

export const fontWeight = {
  regular: "400" as const,
  medium: "500" as const,
  semibold: "600" as const,
  bold: "700" as const,
  extrabold: "800" as const,
};

export const shadow = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHover: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  modal: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 25,
    elevation: 10,
  },
  button: {
    shadowColor: "#17202b",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
};

export const statusColors: Record<string, { bg: string; text: string; icon: string }> = {
  pending: { bg: "#FEF3C7", text: "#D97706", icon: "time-outline" },
  "under-review": { bg: "#DBEAFE", text: "#2563EB", icon: "eye-outline" },
  "in-progress": { bg: "#EDE9FE", text: "#7C3AED", icon: "sync-outline" },
  resolved: { bg: "#D1FAE5", text: "#059669", icon: "checkmark-circle-outline" },
  dismissed: { bg: "#F1F5F9", text: "#64748B", icon: "close-circle-outline" },
  cancelled: { bg: "#FEE2E2", text: "#DC2626", icon: "close-circle-outline" },
};

export const crimeIcons: Record<string, string> = {
  "hit-and-run": "car-sport",
  robbery: "skull",
  theft: "bag-remove",
  assault: "alert-circle",
  vandalism: "hammer",
  burglary: "home-remove",
  others: "shield",
};
