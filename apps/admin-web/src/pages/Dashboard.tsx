import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import type { DashboardStats } from "../types";
import {
  FileText, Clock, Shield, CheckCircle, Users, Megaphone, ArrowRight,
  MapPin, Navigation, BarChart3, AlertTriangle, TrendingUp, Activity,
  Siren, Eye, ArrowUpRight,
} from "lucide-react";
import "mapbox-gl/dist/mapbox-gl.css";

const BARANGAYS = [
  "Bagacay", "Bantayan", "Binaliw", "Borobathon", "Cabilawan",
  "Canhabagat", "Caponayan", "Carayman", "Cogon", "Dalahican", "Danao",
  "Ginabuyan", "Jiabong", "Lagdagan", "Lalab", "Lampano", "Lantaw",
  "Lawaan", "Lonoy", "Lunao", "Mabini", "Malaga", "Malajog",
  "Maya", "Obrero", "Pajo", "Palanas", "Pangdan", "Rawis",
  "San Policarpo", "Santo Niño", "Tagumpay", "Tinambacan", "Tominamos", "Tugas",
];

const statConfig = [
  { key: "totalReports", label: "Total Reports", icon: FileText, color: "#60A5FA", bg: "rgba(37,107,235,0.15)", link: "/dashboard/reports" },
  { key: "pendingReports", label: "Pending", icon: Clock, color: "#FBBF24", bg: "rgba(245,158,11,0.15)", link: "/dashboard/reports" },
  { key: "totalOfficers", label: "Officers", icon: Shield, color: "#60A5FA", bg: "rgba(37,107,235,0.15)", link: null },
  { key: "resolvedReports", label: "Resolved", icon: CheckCircle, color: "#34D399", bg: "rgba(16,185,129,0.15)", link: null },
  { key: "totalResidents", label: "Residents", icon: Users, color: "#A78BFA", bg: "rgba(139,92,246,0.15)", link: null },
  { key: "totalAnnouncements", label: "Announcements", icon: Megaphone, color: "#34D399", bg: "rgba(16,185,129,0.15)", link: "/dashboard/announcements" },
];

const getBarangay = (addr: string): string => {
  const parts = (addr || "").toLowerCase().split(",").map(s => s.trim().replace(/^(brgy\.?\s*|barangay\s*|bgy\.?\s*|bray\.?\s*|purok\s+\d+\s*)/, ""));
  for (const part of parts) {
    for (const name of BARANGAYS) {
      const n = name.toLowerCase();
      if (part.includes(n) || n.includes(part)) return name;
      const pWords = part.split(/\s+/).filter(w => w.length >= 4);
      const nWords = n.split(/\s+/).filter(w => w.length >= 4);
      for (const pw of pWords) {
        for (const nw of nWords) {
          let prefix = 0;
          for (let i = 0; i < Math.min(pw.length, nw.length); i++) {
            if (pw[i] === nw[i]) prefix++; else break;
          }
          if (prefix >= 5) return name;
        }
      }
    }
  }
  return "Calbayog City";
};

export default function Dashboard() {
  const navigate = useNavigate();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const pulseRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentReports, setRecentReports] = useState<any[]>([]);
  const [mapReports, setMapReports] = useState<any[]>([]);
  const [officers, setOfficers] = useState<any[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<any>(null);
  const [barangayStats, setBarangayStats] = useState<{ name: string; total: number }[]>([]);
  const [incidentTypeStats, setIncidentTypeStats] = useState<{ name: string; total: number }[]>([]);
  const [timeRange, setTimeRange] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [timeChartData, setTimeChartData] = useState<{ label: string; count: number }[]>([]);
  const [statusBreakdown, setStatusBreakdown] = useState({ pending: 0, inProgress: 0, resolved: 0, needsBackup: 0, underReview: 0 });
  const [criticalReports, setCriticalReports] = useState<any[]>([]);

  useEffect(() => {
    loadData();
    const channel = supabase
      .channel("admin-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "crime_reports" }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (mapReports.length > 0 && officers.length > 0 && !mapRef.current) {
      initMap();
    }
    return () => {
      if (pulseRef.current) { clearInterval(pulseRef.current); pulseRef.current = null; }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [mapReports, officers]);

  useEffect(() => {
    const counts: Record<string, number> = {};
    for (const r of mapReports) {
      const b = getBarangay(r.location_address);
      counts[b] = (counts[b] || 0) + 1;
    }
    const sorted = Object.entries(counts)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
    setBarangayStats(sorted);

    const now = Date.now();
    const cutoff = timeRange === "daily" ? now - 86400000 : timeRange === "weekly" ? now - 604800000 : now - 2592000000;
    const typeCounts: Record<string, number> = {};
    for (const r of mapReports) {
      if (new Date(r.created_at).getTime() < cutoff) continue;
      const t = (r.crime_type || "unknown").replace(/-/g, " ");
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    }
    const typeSorted = Object.entries(typeCounts)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
    setIncidentTypeStats(typeSorted);

    const timeBuckets: Record<string, number> = {};
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    for (const r of mapReports) {
      const d = new Date(r.created_at);
      let key: string;
      if (timeRange === "daily") key = String(d.getHours()).padStart(2, "0");
      else if (timeRange === "weekly") key = dayNames[d.getDay()];
      else key = String(d.getDate());
      timeBuckets[key] = (timeBuckets[key] || 0) + 1;
    }
    let labels: string[];
    if (timeRange === "daily") labels = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
    else if (timeRange === "weekly") labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    else labels = Array.from({ length: 31 }, (_, i) => String(i + 1));
    setTimeChartData(labels.map(l => ({ label: l, count: timeBuckets[l] || 0 })));

    const sb = { pending: 0, inProgress: 0, resolved: 0, needsBackup: 0, underReview: 0 };
    const critical: any[] = [];
    for (const r of mapReports) {
      if (r.status === "pending") sb.pending++;
      else if (r.status === "in-progress") sb.inProgress++;
      else if (r.status === "resolved") sb.resolved++;
      else if (r.status === "needs-backup") sb.needsBackup++;
      else if (r.status === "under-review") sb.underReview++;
      if (r.status === "needs-backup" || (r.status === "pending" && Date.now() - new Date(r.created_at).getTime() > 3600000)) {
        critical.push(r);
      }
    }
    setStatusBreakdown(sb);
    setCriticalReports(critical.slice(0, 5));
  }, [mapReports, timeRange]);

  const loadData = async () => {
    try {
      const [
        { count: totalReports },
        { count: pendingReports },
        { count: inProgressReports },
        { count: resolvedReports },
        { count: totalOfficers },
        { count: totalAnnouncements },
        { count: totalResidents },
      ] = await Promise.all([
        supabase.from("crime_reports").select("*", { count: "exact", head: true }),
        supabase.from("crime_reports").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("crime_reports").select("*", { count: "exact", head: true }).eq("status", "in-progress"),
        supabase.from("crime_reports").select("*", { count: "exact", head: true }).eq("status", "resolved"),
        supabase.from("police_profiles").select("*", { count: "exact", head: true }),
        supabase.from("announcements").select("*", { count: "exact", head: true }),
        supabase.from("resident_profiles").select("*", { count: "exact", head: true }),
      ]);

      setStats({
        totalReports: totalReports ?? 0,
        pendingReports: pendingReports ?? 0,
        resolvedReports: resolvedReports ?? 0,
        totalOfficers: totalOfficers ?? 0,
        totalAnnouncements: totalAnnouncements ?? 0,
        totalResidents: totalResidents ?? 0,
      });

      const { data: reports } = await supabase
        .from("crime_reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);

      const reportIds = (reports ?? []).map((r: any) => r.id);
      const { data: locations } = await supabase
        .from("police_locations")
        .select("report_id, officer_id, officer:police_profiles(full_name)")
        .in("report_id", reportIds);

      const officerMap: Record<string, string> = {};
      for (const loc of locations ?? []) {
        if (!officerMap[loc.report_id]) officerMap[loc.report_id] = (loc.officer as any)?.full_name || "—";
      }

      const withDetails = await Promise.all(
        (reports ?? []).map(async (r: any) => {
          const { data: rp } = await supabase
            .from("resident_profiles").select("full_name").eq("id", r.resident_id).maybeSingle();
          return { ...r, resident: rp || null, barangay: getBarangay(r.location_address), officer_name: officerMap[r.id] || "—" };
        })
      );
      setRecentReports(withDetails);

      const { data: mapData } = await supabase
        .from("crime_reports")
        .select("id, crime_type, description, status, latitude, longitude, location_address, created_at, resident_id")
        .not("latitude", "is", null).not("longitude", "is", null).limit(200);

      const withResidents = await Promise.all(
        (mapData ?? []).map(async (r: any) => {
          const { data: rp } = await supabase
            .from("resident_profiles").select("full_name").eq("id", r.resident_id).maybeSingle();
          return { ...r, resident_name: (rp as any)?.full_name || "Unknown" };
        })
      );
      setMapReports(withResidents);

      const { data: officerData } = await supabase.from("police_profiles").select("id, full_name, badge_id");
      const { data: officerLocs } = await supabase
        .from("police_locations").select("officer_id, latitude, longitude, updated_at")
        .not("latitude", "is", null).not("longitude", "is", null);

      const officerMap2: Record<string, any> = {};
      for (const o of officerData ?? []) officerMap2[o.id] = o;
      const unique: any[] = [];
      const seen = new Set<string>();
      for (const loc of officerLocs ?? []) {
        if (!seen.has(loc.officer_id)) { seen.add(loc.officer_id); unique.push({ ...loc, officer: officerMap2[loc.officer_id] || null }); }
      }
      setOfficers(unique);
    } catch (err) {
      console.error("Failed to load stats:", err);
    } finally {
      setLoading(false);
    }
  };

  const initMap = async () => {
    try {
      const mapboxgl = await import("mapbox-gl");
      const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string;
      if (!token) { console.error("Mapbox token missing"); return; }
      mapboxgl.accessToken = token;

      const container = document.getElementById("dashboard-map");
      if (!container) return;

      const map = new mapboxgl.Map({
        container,
        style: "mapbox://styles/mapbox/satellite-streets-v12",
        center: [124.6, 12.066],
        zoom: 14,
        pitch: 45,
        bearing: -17.6,
        antialias: true,
        accessToken: token,
      });
      mapRef.current = map;

      map.on("load", async () => {
        const features = mapReports.filter((r) => r.latitude && r.longitude).map((r) => ({
          type: "Feature" as const,
          properties: { id: r.id, crime_type: r.crime_type, status: r.status, description: r.description || "", location_address: r.location_address || "", resident_name: r.resident_name, time: new Date(r.created_at).toLocaleString("en-PH") },
          geometry: { type: "Point" as const, coordinates: [r.longitude, r.latitude] },
        }));

        map.addSource("crimes", { type: "geojson", data: { type: "FeatureCollection", features }, cluster: true, clusterMaxZoom: 13, clusterRadius: 40 });

        map.addLayer({ id: "heatmap", type: "heatmap", source: "crimes", paint: {
          "heatmap-weight": ["interpolate", ["linear"], ["get", "point_count"], 0, 0, 5, 0.6, 10, 1],
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 0.8, 15, 0.5],
          "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(96,165,250,0)", 0.15, "#3b82f6", 0.3, "#60a5fa", 0.5, "#fbbf24", 0.7, "#f59e0b", 0.9, "#ef4444"],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 20, 15, 40],
          "heatmap-opacity": 0.8,
        }});

        map.addLayer({ id: "clusters", type: "circle", source: "crimes", filter: ["has", "point_count"], paint: {
          "circle-color": ["step", ["get", "point_count"], "#60a5fa", 5, "#fbbf24", 10, "#ef4444"],
          "circle-radius": ["step", ["get", "point_count"], 22, 5, 30, 10, 40],
          "circle-opacity": 0.9,
          "circle-stroke-width": 3,
          "circle-stroke-color": "#fff",
        }});

        map.addLayer({ id: "clusters-pulse", type: "circle", source: "crimes", filter: ["has", "point_count"], paint: {
          "circle-color": ["step", ["get", "point_count"], "#60a5fa", 5, "#fbbf24", 10, "#ef4444"],
          "circle-radius": ["step", ["get", "point_count"], 28, 5, 38, 10, 50],
          "circle-opacity": 0,
          "circle-stroke-width": 2,
          "circle-stroke-color": ["step", ["get", "point_count"], "#60a5fa", 5, "#fbbf24", 10, "#ef4444"],
          "circle-stroke-opacity": 0,
        }});

        map.addLayer({ id: "cluster-count", type: "symbol", source: "crimes", filter: ["has", "point_count"], layout: {
          "text-field": ["concat", ["to-string", ["get", "point_count"]], " reports"],
          "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
          "text-size": 13,
          "text-offset": [0, 0.1],
        }, paint: {
          "text-color": "#fff",
          "text-halo-color": "rgba(0,0,0,0.8)",
          "text-halo-width": 2.5,
        }});

        map.addLayer({ id: "points", type: "circle", source: "crimes", filter: ["!", ["has", "point_count"]], paint: {
          "circle-color": ["case", ["==", ["get", "status"], "pending"], "#ef4444", ["==", ["get", "status"], "in-progress"], "#fbbf24", ["==", ["get", "status"], "needs-backup"], "#dc2626", ["==", ["get", "status"], "under-review"], "#60a5fa", ["==", ["get", "status"], "resolved"], "#34d399", "#94a3b8"],
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 6, 14, 10, 18, 14],
          "circle-stroke-width": 3,
          "circle-stroke-color": "#fff",
          "circle-opacity": 0.95,
          "circle-pitch-alignment": "map",
          "circle-pitch-scale": "map",
        }});

        map.addLayer({ id: "point-count", type: "symbol", source: "crimes", filter: ["!", ["has", "point_count"]], layout: {
          "text-field": "1",
          "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
          "text-size": 9,
          "text-allow-overlap": true,
        }, paint: {
          "text-color": "#fff",
          "text-halo-color": "rgba(0,0,0,0.6)",
          "text-halo-width": 1.5,
        }});

        map.addLayer({ id: "points-pulse", type: "circle", source: "crimes", filter: ["!", ["has", "point_count"]], paint: {
          "circle-color": ["case", ["==", ["get", "status"], "pending"], "#ef4444", ["==", ["get", "status"], "in-progress"], "#fbbf24", ["==", ["get", "status"], "needs-backup"], "#dc2626", ["==", ["get", "status"], "under-review"], "#60a5fa", ["==", ["get", "status"], "resolved"], "#34d399", "#94a3b8"],
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 10, 14, 16, 18, 22],
          "circle-opacity": 0,
          "circle-stroke-width": 2,
          "circle-stroke-color": ["case", ["==", ["get", "status"], "pending"], "#ef4444", ["==", ["get", "status"], "in-progress"], "#fbbf24", ["==", ["get", "status"], "needs-backup"], "#dc2626", ["==", ["get", "status"], "under-review"], "#60a5fa", ["==", ["get", "status"], "resolved"], "#34d399", "#94a3b8"],
          "circle-stroke-opacity": 0,
          "circle-pitch-alignment": "map",
          "circle-pitch-scale": "map",
        }});

        let pulseStep = 0;
        pulseRef.current = setInterval(() => {
          if (!map || !map.isStyleLoaded()) return;
          pulseStep = (pulseStep + 1) % 40;
          const t = pulseStep / 40;
          const ease = Math.sin(t * Math.PI);
          const outerOpacity = ease * 0.35;
          const innerOpacity = 0.15 + ease * 0.2;

          try {
            if (map.getLayer("clusters-pulse")) {
              map.setPaintProperty("clusters-pulse", "circle-opacity", outerOpacity);
              map.setPaintProperty("clusters-pulse", "circle-stroke-opacity", outerOpacity * 1.5);
            }
            if (map.getLayer("points-pulse")) {
              map.setPaintProperty("points-pulse", "circle-opacity", outerOpacity);
              map.setPaintProperty("points-pulse", "circle-stroke-opacity", outerOpacity * 1.5);
            }
          } catch {}
        }, 50);

        const officerFeatures = officers.filter((o) => o.latitude && o.longitude).map((o) => ({
          type: "Feature" as const, properties: { id: o.officer_id, name: o.officer?.full_name || "Unknown", badge: o.officer?.badge_id || "", type: "officer" },
          geometry: { type: "Point" as const, coordinates: [o.longitude, o.latitude] },
        }));

        if (officerFeatures.length > 0) {
          map.addSource("officers", { type: "geojson", data: { type: "FeatureCollection", features: officerFeatures } });
          const officerRes = await map.loadImage("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='%233b82f6' stroke='white' stroke-width='2'%3E%3Cpath d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z'/%3E%3C/svg%3E");
          if (officerRes) { map.addImage("officer-marker", officerRes.data); map.addLayer({ id: "officers-layer", type: "symbol", source: "officers", layout: { "icon-image": "officer-marker", "icon-size": 1.2, "icon-allow-overlap": true } }); }
        }

        map.on("click", "points", (e: any) => {
          const f = e.features?.[0];
          if (f) {
            setSelectedIncident(f.properties);
            new mapboxgl.Popup().setLngLat(f.geometry.coordinates).setHTML(`
              <div style="font-family:sans-serif;padding:4px;max-width:220px">
                <strong style="text-transform:capitalize">${f.properties.crime_type?.replace(/-/g, " ") || "Incident"}</strong>
                <div style="font-size:11px;color:#666;margin:4px 0">${f.properties.location_address || "No address"}</div>
                <div style="font-size:11px;color:#666">${f.properties.time}</div>
                <div style="margin-top:4px"><span style="background:${f.properties.status === "pending" ? "#ef4444" : f.properties.status === "in-progress" ? "#fbbf24" : "#34d399"};color:#fff;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:600">${f.properties.status}</span></div>
              </div>
            `).addTo(map);
          }
        });

        map.on("click", "clusters", (e: any) => {
          const f = e.features?.[0];
          if (f) {
            const count = f.properties.point_count;
            new mapboxgl.Popup().setLngLat(f.geometry.coordinates).setHTML(`
              <div style="font-family:sans-serif;padding:4px;text-align:center">
                <strong style="font-size:14px">${count} reports</strong>
              </div>
            `).addTo(map);
            const source = map.getSource("crimes") as any; source.getClusterExpansionZoom(f.properties.cluster_id, (err: any, zoom: number) => { if (!err) map.flyTo({ center: f.geometry.coordinates, zoom }); });
          }
        });

        map.on("click", (e: any) => { const features = map.queryRenderedFeatures(e.point, { layers: ["points"] }); if (!features.length) setSelectedIncident(null); });
      });
    } catch { console.error("Map init failed"); }
  };

  const formatTime = (d: string) => new Date(d).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", hour12: false });
  const totalForStatus = statusBreakdown.pending + statusBreakdown.inProgress + statusBreakdown.resolved + statusBreakdown.needsBackup + statusBreakdown.underReview;
  const resolutionRate = totalForStatus > 0 ? Math.round((statusBreakdown.resolved / totalForStatus) * 100) : 0;

  if (loading) {
    return (
      <div className="page-body" style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
        <div aria-label="Loading..." role="status" className="loader">
          <svg className="icon" viewBox="0 0 256 256">
            <line x1="128" y1="32" x2="128" y2="64" stroke-linecap="round" stroke-linejoin="round" stroke-width="24"></line>
            <line x1="195.9" y1="60.1" x2="173.3" y2="82.7" stroke-linecap="round" stroke-linejoin="round" stroke-width="24"></line>
            <line x1="224" y1="128" x2="192" y2="128" stroke-linecap="round" stroke-linejoin="round" stroke-width="24"></line>
            <line x1="195.9" y1="195.9" x2="173.3" y2="173.3" stroke-linecap="round" stroke-linejoin="round" stroke-width="24"></line>
            <line x1="128" y1="224" x2="128" y2="192" stroke-linecap="round" stroke-linejoin="round" stroke-width="24"></line>
            <line x1="60.1" y1="195.9" x2="82.7" y2="173.3" stroke-linecap="round" stroke-linejoin="round" stroke-width="24"></line>
            <line x1="32" y1="128" x2="64" y2="128" stroke-linecap="round" stroke-linejoin="round" stroke-width="24"></line>
            <line x1="60.1" y1="60.1" x2="82.7" y2="82.7" stroke-linecap="round" stroke-linejoin="round" stroke-width="24"></line>
          </svg>
          <span className="loading-text">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - var(--header-height, 48px))", overflow: "hidden" }}>
      <div className="page-header" style={{ flexShrink: 0 }}>
        <h2>Dashboard</h2>
        <span style={{ fontSize: 13, color: "var(--gray-400)" }}>
          {new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0, padding: 16, display: "flex", gap: 12, overflow: "hidden" }}>

        {/* ===== LEFT COLUMN: Heatmap + Recent Reports ===== */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>

          {/* Heatmap */}
          <div className="card" style={{ flex: 4, padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderBottom: "1px solid var(--gray-300)", flexShrink: 0 }}>
              <h3 style={{ fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
                <MapPin size={12} /> Heatmap
              </h3>
              <div style={{ display: "flex", gap: 8, fontSize: 8, alignItems: "center", color: "var(--gray-500)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 2 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} /> Active</span>
                <span style={{ display: "flex", alignItems: "center", gap: 2 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fbbf24", display: "inline-block" }} /> Responding</span>
                <span style={{ display: "flex", alignItems: "center", gap: 2 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399", display: "inline-block" }} /> Resolved</span>
                <span style={{ display: "flex", alignItems: "center", gap: 2 }}><Navigation size={8} color="#3b82f6" /> Officer</span>
              </div>
            </div>
            <div id="dashboard-map" ref={mapContainer} style={{ flex: 1, minHeight: 0 }} />
          </div>

          {/* Recent Reports */}
          <div className="card" style={{ flex: 1, padding: 0, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden", minHeight: 0, maxHeight: 200 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderBottom: "1px solid var(--gray-300)", flexShrink: 0 }}>
              <h3 style={{ fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
                <FileText size={11} /> Recent Reports
              </h3>
              <button className="btn btn-sm btn-outline" onClick={() => navigate("/dashboard/reports")} style={{ fontSize: 9, padding: "2px 8px" }}>
                View All <ArrowRight size={9} />
              </button>
            </div>
            <div style={{ flex: 1, overflow: "hidden" }}>
              {recentReports.length > 0 ? (
                <table style={{ width: "100%", fontSize: 9, borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ padding: "5px 10px", fontSize: 8, textAlign: "left", fontWeight: 700, color: "var(--gray-500)", textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "1px solid var(--gray-300)", background: "var(--gray-50)" }}>Time</th>
                      <th style={{ padding: "5px 10px", fontSize: 8, textAlign: "left", fontWeight: 700, color: "var(--gray-500)", textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "1px solid var(--gray-300)", background: "var(--gray-50)" }}>Incident</th>
                      <th style={{ padding: "5px 10px", fontSize: 8, textAlign: "left", fontWeight: 700, color: "var(--gray-500)", textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "1px solid var(--gray-300)", background: "var(--gray-50)" }}>Barangay</th>
                      <th style={{ padding: "5px 10px", fontSize: 8, textAlign: "left", fontWeight: 700, color: "var(--gray-500)", textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "1px solid var(--gray-300)", background: "var(--gray-50)" }}>Officer</th>
                      <th style={{ padding: "5px 10px", fontSize: 8, textAlign: "left", fontWeight: 700, color: "var(--gray-500)", textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "1px solid var(--gray-300)", background: "var(--gray-50)" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentReports.map((r) => (
                      <tr key={r.id} className="clickable-row" onClick={() => navigate(`/dashboard/reports/${r.id}`)} style={{ cursor: "pointer" }}>
                        <td style={{ padding: "5px 10px", color: "var(--gray-400)", whiteSpace: "nowrap", borderBottom: "1px solid var(--gray-300)" }}>{formatTime(r.created_at)}</td>
                        <td style={{ padding: "5px 10px", textTransform: "capitalize", fontWeight: 600, color: "var(--gray-900)", borderBottom: "1px solid var(--gray-300)" }}>{r.crime_type?.replace(/-/g, " ")}</td>
                        <td style={{ padding: "5px 10px", color: "var(--gray-600)", borderBottom: "1px solid var(--gray-300)" }}>{r.barangay}</td>
                        <td style={{ padding: "5px 10px", color: "var(--gray-600)", borderBottom: "1px solid var(--gray-300)" }}>{r.officer_name}</td>
                        <td style={{ padding: "5px 10px", borderBottom: "1px solid var(--gray-300)" }}>
                          <span className={`badge badge-${r.status}`} style={{ fontSize: 8, padding: "1px 5px" }}>{r.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="empty-state" style={{ padding: "12px 0" }}>
                  <div className="empty-icon" style={{ width: 32, height: 32 }}><FileText size={14} /></div>
                  <h3 style={{ fontSize: 10 }}>No Reports Yet</h3>
                  <p style={{ fontSize: 9 }}>Reports from residents will appear here</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ===== RIGHT COLUMN: Stats + Status + Charts ===== */}
        <div style={{ width: 340, flexShrink: 0, display: "flex", flexDirection: "column", gap: 10, overflow: "hidden" }}>

          {/* Stats Row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, flexShrink: 0 }}>
            {statConfig.map((cfg) => {
              const value = stats ? (stats as any)[cfg.key] ?? 0 : 0;
              const Icon = cfg.icon;
              return (
                <div key={cfg.key} className={`stat-card${cfg.link ? " clickable" : ""}`} onClick={cfg.link ? () => navigate(cfg.link) : undefined} style={{ padding: "10px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <div className="stat-icon" style={{ width: 30, height: 30, marginBottom: 0, background: cfg.bg, color: cfg.color }}>
                      <Icon size={14} />
                    </div>
                    {cfg.link && <ArrowUpRight size={10} style={{ color: "var(--gray-400)" }} />}
                  </div>
                  <div className="stat-label" style={{ fontSize: 10, marginBottom: 1 }}>{cfg.label}</div>
                  <div className="stat-value" style={{ fontSize: 20 }}>{value}</div>
                </div>
              );
            })}
          </div>

          {/* Status Breakdown */}
          <div className="card" style={{ padding: 12, flexShrink: 0 }}>
            <h3 style={{ fontSize: 9, fontWeight: 700, color: "var(--gray-400)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
              <Activity size={10} /> Status Overview
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ position: "relative", width: 60, height: 60, flexShrink: 0 }}>
                <svg viewBox="0 0 36 36" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
                  {totalForStatus > 0 && (() => {
                    const segments = [
                      { value: statusBreakdown.resolved, color: "#34d399" },
                      { value: statusBreakdown.inProgress, color: "#60a5fa" },
                      { value: statusBreakdown.pending, color: "#fbbf24" },
                      { value: statusBreakdown.needsBackup, color: "#ef4444" },
                      { value: statusBreakdown.underReview, color: "#a78bfa" },
                    ];
                    let offset = 0;
                    return segments.filter(s => s.value > 0).map((s, i) => {
                      const pct = (s.value / totalForStatus) * 100;
                      const dash = `${pct} ${100 - pct}`;
                      const el = <circle key={i} cx="18" cy="18" r="15.915" fill="none" stroke={s.color} strokeWidth="3" strokeDasharray={dash} strokeDashoffset={-offset} strokeLinecap="round" style={{ transition: "stroke-dasharray 0.5s ease" }} />;
                      offset += pct;
                      return el;
                    });
                  })()}
                  {totalForStatus === 0 && <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--gray-200)" strokeWidth="3" />}
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: "var(--gray-900)", lineHeight: 1 }}>{resolutionRate}%</span>
                  <span style={{ fontSize: 6, color: "var(--gray-500)", fontWeight: 600 }}>RESOLVED</span>
                </div>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                {[
                  { label: "Pending", value: statusBreakdown.pending, color: "#fbbf24" },
                  { label: "In Progress", value: statusBreakdown.inProgress, color: "#60a5fa" },
                  { label: "Resolved", value: statusBreakdown.resolved, color: "#34d399" },
                  { label: "Needs Backup", value: statusBreakdown.needsBackup, color: "#ef4444" },
                  { label: "Under Review", value: statusBreakdown.underReview, color: "#a78bfa" },
                ].map(s => (
                  <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 9 }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, color: "var(--gray-500)" }}>{s.label}</span>
                    <span style={{ fontWeight: 700, color: "var(--gray-900)", minWidth: 14, textAlign: "right" }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Reports Over Time */}
          <div className="card" style={{ padding: 12, flexShrink: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <h3 style={{ fontSize: 9, fontWeight: 700, color: "var(--gray-400)", textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: 4 }}>
                <TrendingUp size={10} /> Reports Over Time
              </h3>
              <div style={{ display: "flex", gap: 1, background: "var(--gray-200)", borderRadius: 3, padding: 1 }}>
                {(["daily", "weekly", "monthly"] as const).map(r => (
                  <button key={r} onClick={() => setTimeRange(r)} style={{
                    padding: "2px 6px", fontSize: 8, fontWeight: 600, cursor: "pointer",
                    border: "none", borderRadius: 2, textTransform: "capitalize",
                    background: timeRange === r ? "var(--gray-100)" : "transparent",
                    color: timeRange === r ? "var(--gray-900)" : "var(--gray-500)",
                  }}>{r === "daily" ? "Day" : r === "weekly" ? "Week" : "Month"}</button>
                ))}
              </div>
            </div>
            <div style={{ height: 100, display: "flex", alignItems: "center" }}>
              {timeChartData.length > 0 ? (() => {
                const w = 300, h = 100, padL = 26, padR = 6, padT = 6, padB = 16;
                const innerW = w - padL - padR, innerH = h - padT - padB;
                const max = Math.max(...timeChartData.map(d => d.count), 1);
                const points = timeChartData.map((d, i) => {
                  const x = padL + (i / Math.max(timeChartData.length - 1, 1)) * innerW;
                  const y = padT + innerH - (d.count / max) * innerH;
                  return `${x},${y}`;
                }).join(" ");
                const areaPoints = `${padL},${padT + innerH} ${points} ${padL + innerW},${padT + innerH}`;
                const steps = 3;
                const yLabels = Array.from({ length: steps + 1 }, (_, i) => Math.round((max / steps) * (steps - i)));
                return (
                  <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "100%" }} preserveAspectRatio="xMidYMid meet">
                    <defs>
                      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--gray-900)" stopOpacity="0.15" />
                        <stop offset="100%" stopColor="var(--gray-900)" stopOpacity="0.01" />
                      </linearGradient>
                    </defs>
                    {yLabels.map((v, i) => {
                      const y = padT + (i / steps) * innerH;
                      return (
                        <g key={i}>
                          <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="var(--gray-300)" strokeWidth={0.5} strokeDasharray="3,3" />
                          <text x={padL - 4} y={y + 3} textAnchor="end" fill="var(--gray-500)" fontSize={7}>{v}</text>
                        </g>
                      );
                    })}
                    <polygon points={areaPoints} fill="url(#areaGrad)" />
                    <polyline points={points} fill="none" stroke="var(--gray-900)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    {timeChartData.map((d, i) => {
                      const x = padL + (i / Math.max(timeChartData.length - 1, 1)) * innerW;
                      const y = padT + innerH - (d.count / max) * innerH;
                      return d.count > 0 ? <circle key={i} cx={x} cy={y} r={2} fill="var(--gray-900)" stroke="var(--gray-100)" strokeWidth={1.5} /> : null;
                    })}
                    {timeChartData.filter((_, i) => {
                      const total = timeChartData.length;
                      if (total <= 7) return true;
                      const step = Math.ceil(total / 7);
                      return i % step === 0 || i === total - 1;
                    }).map((d, i) => {
                      const idx = timeChartData.indexOf(d);
                      const x = padL + (idx / Math.max(timeChartData.length - 1, 1)) * innerW;
                      return (
                        <text key={i} x={x} y={h - 4} textAnchor="middle" fill="var(--gray-500)" fontSize={7}>
                          {d.label.length > 3 ? d.label.slice(0, 3) : d.label}
                        </text>
                      );
                    })}
                  </svg>
                );
              })() : (
                <div style={{ fontSize: 10, color: "var(--gray-500)", width: "100%", textAlign: "center" }}>No data</div>
              )}
            </div>
          </div>

          {/* Incident Types */}
          <div className="card" style={{ padding: 12, flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0 }}>
            <h3 style={{ fontSize: 9, fontWeight: 700, color: "var(--gray-400)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6, display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
              <Siren size={10} /> Incident Types
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1, overflow: "hidden" }}>
              {incidentTypeStats.length > 0 ? incidentTypeStats.map((t, i) => {
                const max = incidentTypeStats[0].total;
                const pct = max > 0 ? (t.total / max) * 100 : 0;
                const colors = ["#60a5fa", "#f59e0b", "#ef4444", "#a78bfa", "#34d399", "#f472b6"];
                const c = colors[i % colors.length];
                return (
                  <div key={t.name} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 64, fontSize: 9, color: "var(--gray-600)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textTransform: "capitalize", fontWeight: 500 }}>{t.name}</span>
                    <div style={{ flex: 1, height: 5, background: "var(--gray-200)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: c, borderRadius: 3, transition: "width 0.4s ease" }} />
                    </div>
                    <span style={{ fontSize: 8, fontWeight: 700, color: "var(--gray-500)", minWidth: 12, textAlign: "right" }}>{t.total}</span>
                  </div>
                );
              }) : (
                <div style={{ fontSize: 9, color: "var(--gray-500)", padding: "12px 0", textAlign: "center" }}>No data</div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
