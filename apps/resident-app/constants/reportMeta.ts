export const STATUS_META: Record<string, { bg: string; text: string; icon: string; label: string; accent: string }> = {
  pending: {
    bg: "#FEF3C7", text: "#D97706", icon: "time-outline", label: "Pending", accent: "#F59E0B",
  },
  "under-review": {
    bg: "#DBEAFE", text: "#2563EB", icon: "eye-outline", label: "Reviewing", accent: "#3B82F6",
  },
  "in-progress": {
    bg: "#EDE9FE", text: "#7C3AED", icon: "sync-outline", label: "In Progress", accent: "#8B5CF6",
  },
  resolved: {
    bg: "#D1FAE5", text: "#059669", icon: "checkmark-circle-outline", label: "Resolved", accent: "#10B981",
  },
  dismissed: {
    bg: "#F1F5F9", text: "#64748B", icon: "close-circle-outline", label: "Dismissed", accent: "#94A3B8",
  },
  cancelled: {
    bg: "#FEE2E2", text: "#DC2626", icon: "close-circle-outline", label: "Cancelled", accent: "#EF4444",
  },
};

export const CRIME_ICONS: Record<string, string> = {
  "hit-and-run": "car-sport",
  robbery: "skull",
  theft: "bag-remove",
  assault: "alert-circle",
  vandalism: "hammer",
  burglary: "home-remove",
  murder: "skull",
  homicide: "body",
  "physical-injury": "bandage",
  rape: "heart-dislike",
  kidnapping: "lock-closed",
  carnapping: "car",
  arson: "flame",
  estafa: "cash",
  "illegal-drugs": "flask",
  "illegal-gambling": "dice",
  cybercrime: "desktop",
  "domestic-violence": "heart",
  "child-abuse": "person-remove",
  threats: "alert-circle",
  harassment: "megaphone",
  trespassing: "enter",
  disturbance: "volume-high",
  others: "shield",
};

export const CRIME_COLORS: Record<string, string> = {
  "hit-and-run": "#EF4444",
  robbery: "#7C3AED",
  theft: "#F59E0B",
  assault: "#DC2626",
  vandalism: "#0891B2",
  burglary: "#2563EB",
  murder: "#DC2626",
  homicide: "#9F1239",
  "physical-injury": "#F43F5E",
  rape: "#DB2777",
  kidnapping: "#7C3AED",
  carnapping: "#3B82F6",
  arson: "#F97316",
  estafa: "#D97706",
  "illegal-drugs": "#16A34A",
  "illegal-gambling": "#0D9488",
  cybercrime: "#0284C7",
  "domestic-violence": "#E11D48",
  "child-abuse": "#C026D3",
  threats: "#EA580C",
  harassment: "#0891B2",
  trespassing: "#059669",
  disturbance: "#475569",
  others: "#64748B",
};

export const FILTERS = [
  { id: "all", label: "All Reports", icon: "grid-outline" },
  { id: "pending", label: "Pending", icon: "time-outline" },
  { id: "under-review", label: "Reviewing", icon: "eye-outline" },
  { id: "in-progress", label: "In Progress", icon: "sync-outline" },
  { id: "resolved", label: "Resolved", icon: "checkmark-circle-outline" },
  { id: "dismissed", label: "Dismissed", icon: "close-circle-outline" },
  { id: "cancelled", label: "Cancelled", icon: "close-circle-outline" },
];

export function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-PH", {
    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function getTimeAgo(dateStr: string) {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function parseEvidenceUrls(photoUrl: string | null | undefined): string[] {
  if (!photoUrl) return [];
  return photoUrl.split(",").map((u: string) => u.trim()).filter(Boolean);
}

export function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|avi|webm|mkv)$/i.test(url) || url.includes("/videos/");
}