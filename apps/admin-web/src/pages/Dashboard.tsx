import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import type { DashboardStats } from "../types";
import { FileText, Clock, Shield, CheckCircle, Users, Megaphone, ArrowRight, MapPin, Navigation, BarChart3 } from "lucide-react";

const BARANGAYS = [
  "Bagacay", "Bantayan", "Binaliw", "Borobathon", "Cabilawan",
  "Canhabagat", "Caponayan", "Carayman", "Cogon", "Dalahican", "Danao",
  "Ginabuyan", "Jiabong", "Lagdagan", "Lalab", "Lampano", "Lantaw",
  "Lawaan", "Lonoy", "Lunao", "Mabini", "Malaga", "Malajog",
  "Maya", "Obrero", "Pajo", "Palanas", "Pangdan", "Rawis",
  "San Policarpo", "Santo Niño", "Tagumpay", "Tinambacan", "Tominamos", "Tugas",
];

const statConfig = [
  { key: "totalReports", label: "Total Reports", icon: FileText, color: "#60A5FA", bg: "rgba(37,107,235,0.15)", link: "/reports" },
  { key: "pendingReports", label: "Pending Reports", icon: Clock, color: "#FBBF24", bg: "rgba(245,158,11,0.15)", link: "/reports" },
  { key: "totalOfficers", label: "Active Officers", icon: Shield, color: "#60A5FA", bg: "rgba(37,107,235,0.15)", link: null },
  { key: "resolvedReports", label: "Resolved Reports", icon: CheckCircle, color: "#34D399", bg: "rgba(16,185,129,0.15)", link: null },
  { key: "totalResidents", label: "Total Residents", icon: Users, color: "#A78BFA", bg: "rgba(139,92,246,0.15)", link: null },
  { key: "totalAnnouncements", label: "Announcements", icon: Megaphone, color: "#34D399", bg: "rgba(16,185,129,0.15)", link: "/announcements" },
];

const getBarangay = (addr: string): string => {
  const parts = (addr || "").toLowerCase().split(",").map(s => s.trim().replace(/^(brgy\.?\s*|barangay\s*|bgy\.?\s*|bray\.?\s*|purok\s+\d+\s*)/, ""));
  for (const part of parts) {
    for (const name of BARANGAYS) {
      const n = name.toLowerCase();
      if (part.includes(n) || n.includes(part)) return name;
      // Fuzzy: check word-prefix overlap (handles misspellings like "Policarpio" vs "Policarpo")
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

  useEffect(() => {
    loadData();
    const channel = supabase
      .channel("admin-dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "crime_reports" },
        () => loadData()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (mapReports.length > 0 && officers.length > 0 && !mapRef.current) {
      initMap();
    }
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
      .slice(0, 10);
    setBarangayStats(sorted);

    const now = Date.now();
    const cutoff = timeRange === "daily" ? now - 86400000 : timeRange === "weekly" ? now - 604800000 : timeRange === "monthly" ? now - 2592000000 : 0;
    const typeCounts: Record<string, number> = {};
    for (const r of mapReports) {
      if (new Date(r.created_at).getTime() < cutoff) continue;
      const t = (r.crime_type || "unknown").replace(/-/g, " ");
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    }
    const typeSorted = Object.entries(typeCounts)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
    setIncidentTypeStats(typeSorted);

    const timeBuckets: Record<string, number> = {};
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    for (const r of mapReports) {
      const d = new Date(r.created_at);
      let key: string;
      if (timeRange === "daily") {
        key = String(d.getHours()).padStart(2, "0");
      } else if (timeRange === "weekly") {
        key = dayNames[d.getDay()];
      } else {
        key = String(d.getDate());
      }
      timeBuckets[key] = (timeBuckets[key] || 0) + 1;
    }
    let labels: string[];
    if (timeRange === "daily") {
      labels = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
    } else if (timeRange === "weekly") {
      labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    } else {
      labels = Array.from({ length: 31 }, (_, i) => String(i + 1));
    }
    setTimeChartData(labels.map(l => ({ label: l, count: timeBuckets[l] || 0 })));
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
        if (!officerMap[loc.report_id]) {
          officerMap[loc.report_id] = (loc.officer as any)?.full_name || "—";
        }
      }

      const withDetails = await Promise.all(
        (reports ?? []).map(async (r: any) => {
          const { data: rp } = await supabase
            .from("resident_profiles")
            .select("full_name")
            .eq("id", r.resident_id)
            .maybeSingle();
          return {
            ...r,
            resident: rp || null,
            barangay: getBarangay(r.location_address),
            officer_name: officerMap[r.id] || "—",
          };
        })
      );
      setRecentReports(withDetails);

      const { data: mapData } = await supabase
        .from("crime_reports")
        .select("id, crime_type, description, status, latitude, longitude, location_address, created_at, resident_id")
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .limit(200);

      const withResidents = await Promise.all(
        (mapData ?? []).map(async (r: any) => {
          const { data: rp } = await supabase
            .from("resident_profiles")
            .select("full_name")
            .eq("id", r.resident_id)
            .maybeSingle();
          return { ...r, resident_name: (rp as any)?.full_name || "Unknown" };
        })
      );
      setMapReports(withResidents);

      const { data: officerData } = await supabase
        .from("police_profiles")
        .select("id, full_name, badge_id");

      const { data: officerLocs } = await supabase
        .from("police_locations")
        .select("officer_id, latitude, longitude, updated_at")
        .not("latitude", "is", null)
        .not("longitude", "is", null);

      const officerMap2: Record<string, any> = {};
      for (const o of officerData ?? []) officerMap2[o.id] = o;

      const unique: any[] = [];
      const seen = new Set<string>();
      for (const loc of officerLocs ?? []) {
        if (!seen.has(loc.officer_id)) {
          seen.add(loc.officer_id);
          unique.push({ ...loc, officer: officerMap2[loc.officer_id] || null });
        }
      }
      setOfficers(unique);
    } catch (err) {
      console.error("Failed to load stats:", err);
    } finally {
      setLoading(false);
    }
  };

  const getMapStyle = () => {
    try {
      const t = localStorage.getItem("admin-theme");
      return t === "light"
        ? "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
        : "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
    } catch {
      return "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
    }
  };

  const initMap = async () => {
    try {
      const maplibre = await import("maplibre-gl");
      const map = new maplibre.Map({
        container: mapContainer.current!,
        style: getMapStyle(),
        center: [124.6, 12.07],
        zoom: 11,
      });
      mapRef.current = map;

      map.on("load", async () => {
        const features = mapReports
          .filter((r) => r.latitude && r.longitude)
          .map((r) => ({
            type: "Feature" as const,
            properties: {
              id: r.id, crime_type: r.crime_type, status: r.status,
              description: r.description || "",
              location_address: r.location_address || "",
              resident_name: r.resident_name,
              time: new Date(r.created_at).toLocaleString("en-PH"),
            },
            geometry: { type: "Point" as const, coordinates: [r.longitude, r.latitude] },
          }));

        const geojson: any = { type: "FeatureCollection", features };

        map.addSource("crimes", {
          type: "geojson",
          data: geojson,
          cluster: true,
          clusterMaxZoom: 13,
          clusterRadius: 40,
        });

        map.addLayer({
          id: "heatmap",
          type: "heatmap",
          source: "crimes",
          paint: {
            "heatmap-weight": ["interpolate", ["linear"], ["get", "point_count"], 0, 0, 5, 0.5, 10, 1],
            "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 0.6, 15, 0.3],
            "heatmap-color": [
              "interpolate", ["linear"], ["heatmap-density"],
              0, "rgba(96,165,250,0)",
              0.2, "#60a5fa",
              0.4, "#fbbf24",
              0.6, "#f59e0b",
              0.8, "#ef4444",
            ],
            "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 15, 15, 30],
            "heatmap-opacity": 0.7,
          },
        });

        map.addLayer({
          id: "clusters",
          type: "circle",
          source: "crimes",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": ["step", ["get", "point_count"], "#60a5fa", 5, "#fbbf24", 10, "#ef4444"],
            "circle-radius": ["step", ["get", "point_count"], 18, 5, 26, 10, 34],
            "circle-opacity": 0.8,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#fff",
          },
        });

        map.addLayer({
          id: "cluster-count",
          type: "symbol",
          source: "crimes",
          filter: ["has", "point_count"],
          layout: {
            "text-field": "{point_count_abbreviated}",
            "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
            "text-size": 11,
          },
          paint: { "text-color": "#fff" },
        });

        map.addLayer({
          id: "points",
          type: "circle",
          source: "crimes",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": [
              "case",
              ["==", ["get", "status"], "pending"], "#ef4444",
              ["==", ["get", "status"], "in-progress"], "#fbbf24",
              ["==", ["get", "status"], "needs-backup"], "#dc2626",
              ["==", ["get", "status"], "under-review"], "#60a5fa",
              ["==", ["get", "status"], "resolved"], "#34d399",
              "#94a3b8"
            ],
            "circle-radius": 7,
            "circle-stroke-width": 2.5,
            "circle-stroke-color": "#fff",
          },
        });

        const officerFeatures = officers
          .filter((o) => o.latitude && o.longitude)
          .map((o) => ({
            type: "Feature" as const,
            properties: {
              id: o.officer_id,
              name: o.officer?.full_name || "Unknown",
              badge: o.officer?.badge_id || "",
              type: "officer",
            },
            geometry: { type: "Point" as const, coordinates: [o.longitude, o.latitude] },
          }));

        if (officerFeatures.length > 0) {
          map.addSource("officers", {
            type: "geojson",
            data: { type: "FeatureCollection", features: officerFeatures },
          });

          const officerRes = await map.loadImage(
            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='%233b82f6' stroke='white' stroke-width='2'%3E%3Cpath d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z'/%3E%3C/svg%3E"
          );
          if (officerRes) {
            map.addImage("officer-marker", officerRes.data);
            map.addLayer({
              id: "officers-layer",
              type: "symbol",
              source: "officers",
              layout: {
                "icon-image": "officer-marker",
                "icon-size": 1.2,
                "icon-allow-overlap": true,
              },
            });
          }
        }

        map.on("click", "points", (e: any) => {
          const f = e.features?.[0];
          if (f) {
            setSelectedIncident(f.properties);
            new maplibre.Popup()
              .setLngLat(f.geometry.coordinates)
              .setHTML(`
                <div style="font-family:sans-serif;padding:4px;max-width:220px">
                  <strong style="text-transform:capitalize">${f.properties.crime_type?.replace(/-/g, " ") || "Incident"}</strong>
                  <div style="font-size:11px;color:#666;margin:4px 0">${f.properties.location_address || "No address"}</div>
                  <div style="font-size:11px;color:#666">${f.properties.time}</div>
                  <div style="margin-top:4px"><span style="background:${f.properties.status === "pending" ? "#ef4444" : f.properties.status === "in-progress" ? "#fbbf24" : "#34d399"};color:#fff;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:600">${f.properties.status}</span></div>
                </div>
              `)
              .addTo(map);
          }
        });

        map.on("click", "clusters", (e: any) => {
          const f = e.features?.[0];
          if (f) {
            const source = map.getSource("crimes") as any;
            source.getClusterExpansionZoom(f.properties.cluster_id, (err: any, zoom: number) => {
              if (!err) map.flyTo({ center: f.geometry.coordinates, zoom });
            });
          }
        });

        map.on("click", (e: any) => {
          const features = map.queryRenderedFeatures(e.point, { layers: ["points"] });
          if (!features.length) setSelectedIncident(null);
        });
      });
    } catch {
      console.error("Map init failed");
    }
  };

  const formatTime = (d: string) =>
    new Date(d).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", hour12: false });

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
    <>
      <div className="page-header">
        <h2>Dashboard</h2>
        <span style={{ fontSize: 13, color: "var(--gray-400)" }}>
          {new Date().toLocaleDateString("en-PH", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </div>
      <div className="page-body">
         <div className="stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 10 }}>
          {statConfig.map((cfg) => {
            const value = stats ? (stats as any)[cfg.key] ?? 0 : 0;
            const Icon = cfg.icon;
            return (
              <div
                key={cfg.key}
                className={`stat-card${cfg.link ? " clickable" : ""}`}
                onClick={cfg.link ? () => navigate(cfg.link) : undefined}
                style={{ padding: 12 }}
              >
                <div className="stat-icon" style={{ width: 30, height: 30, marginBottom: 8, background: cfg.bg, color: cfg.color }}>
                  <Icon size={14} />
                </div>
                <div className="stat-label" style={{ fontSize: 10, marginBottom: 2 }}>{cfg.label}</div>
                <div className="stat-value" style={{ fontSize: 20 }}>{value}</div>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <div className="card" style={{ padding: 0, overflow: "hidden", flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid var(--gray-300)" }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                <MapPin size={14} /> Crime Location Heatmap
              </h3>
              <div style={{ display: "flex", gap: 12, fontSize: 10, alignItems: "center" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} /> Active</span>
                <span style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#fbbf24", display: "inline-block" }} /> Responding</span>
                <span style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#34d399", display: "inline-block" }} /> Resolved</span>
                <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Navigation size={10} color="#3b82f6" /> Officer</span>
              </div>
            </div>
            <div ref={mapContainer} style={{ width: "100%", height: 130 }} />
          </div>
          <div className="card" style={{ padding: 10, width: 200, flexShrink: 0 }}>
            <h3 style={{ fontSize: 10, fontWeight: 700, marginBottom: 4, color: "var(--gray-400)", textTransform: "uppercase", letterSpacing: "0.3px", display: "flex", alignItems: "center", gap: 4 }}>
              <BarChart3 size={10} /> Incident Types
            </h3>
            <div style={{ display: "flex", gap: 3, marginBottom: 6 }}>
              {(["daily", "weekly", "monthly"] as const).map(r => (
                <button key={r} onClick={() => setTimeRange(r)}
                  style={{
                    flex: 1, padding: "2px 0", fontSize: 9, fontWeight: 600, cursor: "pointer",
                    border: "none", borderRadius: 3, textTransform: "capitalize",
                    background: timeRange === r ? "var(--gray-200)" : "transparent",
                    color: timeRange === r ? "var(--gray-400)" : "var(--gray-500)",
                  }}
                >{r === "daily" ? "Day" : r === "weekly" ? "Week" : "Month"}</button>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {incidentTypeStats.length > 0 ? (
                incidentTypeStats.map((t) => {
                  const max = incidentTypeStats[0].total;
                  const pct = Math.round((t.total / max) * 100);
                  return (
                    <div key={t.name} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 72, fontSize: 9, color: "var(--gray-500)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textTransform: "capitalize" }}>{t.name}</span>
                      <div style={{ flex: 1, height: 8, background: "var(--gray-200)", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg, #f59e0b, #ef4444)", borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 9, fontWeight: 600, color: "var(--gray-400)", width: 16, textAlign: "right" }}>{t.total}</span>
                    </div>
                  );
                })
              ) : (
                <div style={{ fontSize: 10, color: "var(--gray-500)", padding: "12px 0", textAlign: "center" }}>No data</div>
              )}
            </div>
          </div>
          <div className="card" style={{ padding: 10, width: 200, flexShrink: 0 }}>
            <h3 style={{ fontSize: 10, fontWeight: 700, marginBottom: 6, color: "var(--gray-400)", textTransform: "uppercase", letterSpacing: "0.3px" }}>Reports by Barangay</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {barangayStats.length > 0 ? (
                barangayStats.map((b) => {
                  const max = barangayStats[0].total;
                  const pct = Math.round((b.total / max) * 100);
                  return (
                    <div key={b.name} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 80, fontSize: 10, color: "var(--gray-500)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.name}</span>
                      <div style={{ flex: 1, height: 8, background: "var(--gray-200)", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: "var(--gray-900)", borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 9, fontWeight: 600, color: "var(--gray-400)", width: 16, textAlign: "right" }}>{b.total}</span>
                    </div>
                  );
                })
              ) : (
                <div style={{ fontSize: 10, color: "var(--gray-500)", padding: "12px 0", textAlign: "center" }}>No data</div>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <div className="card" style={{ padding: 10, flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h3 style={{ fontSize: 12, fontWeight: 700 }}>Recent Reports</h3>
              <button className="btn btn-sm btn-outline" onClick={() => navigate("/reports")} style={{ fontSize: 10, padding: "2px 8px" }}>
                View All <ArrowRight size={10} />
              </button>
            </div>
            {recentReports.length > 0 ? (
              <div className="table-container" style={{ border: "none", borderRadius: 0 }}>
                <table style={{ fontSize: 11 }}>
                  <thead>
                    <tr>
                      <th style={{ padding: "3px 6px", fontSize: 9 }}>Time</th>
                      <th style={{ padding: "3px 6px", fontSize: 9 }}>Incident</th>
                      <th style={{ padding: "3px 6px", fontSize: 9 }}>Barangay</th>
                      <th style={{ padding: "3px 6px", fontSize: 9 }}>Officer</th>
                      <th style={{ padding: "3px 6px", fontSize: 9 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentReports.map((r) => (
                      <tr key={r.id} className="clickable-row" onClick={() => navigate(`/reports/${r.id}`)}>
                        <td style={{ padding: "3px 6px", color: "var(--gray-400)", whiteSpace: "nowrap" }}>{formatTime(r.created_at)}</td>
                        <td style={{ padding: "3px 6px", textTransform: "capitalize", fontWeight: 600, fontSize: 11 }}>
                          {r.crime_type?.replace(/-/g, " ")}
                        </td>
                        <td style={{ padding: "3px 6px", fontSize: 11 }}>{r.barangay}</td>
                        <td style={{ padding: "3px 6px", fontSize: 11 }}>{r.officer_name}</td>
                        <td style={{ padding: "3px 6px" }}>
                          <span className={`badge badge-${r.status}`} style={{ fontSize: 9, padding: "1px 6px" }}>{r.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: "12px 0" }}>
                <div className="empty-icon"><FileText size={18} /></div>
                <h3 style={{ fontSize: 13 }}>No Reports Yet</h3>
                <p style={{ fontSize: 11 }}>Reports from residents will appear here</p>
              </div>
            )}
          </div>

          <div className="card" style={{ padding: 10, width: 260, flexShrink: 0 }}>
            <h3 style={{ fontSize: 10, fontWeight: 700, marginBottom: 6, color: "var(--gray-400)", textTransform: "uppercase", letterSpacing: "0.3px" }}>
              Reports Over Time
            </h3>
            <div style={{ display: "flex", gap: 3, marginBottom: 6 }}>
              {(["daily", "weekly", "monthly"] as const).map(r => (
                <button key={r} onClick={() => setTimeRange(r)}
                  style={{
                    flex: 1, padding: "2px 0", fontSize: 9, fontWeight: 600, cursor: "pointer",
                    border: "none", borderRadius: 3, textTransform: "capitalize",
                    background: timeRange === r ? "var(--gray-200)" : "transparent",
                    color: timeRange === r ? "var(--gray-400)" : "var(--gray-500)",
                  }}
                >{r === "daily" ? "Daily" : r === "weekly" ? "Weekly" : "Monthly"}</button>
              ))}
            </div>
            {timeChartData.length > 0 ? (() => {
              const w = 240, h = 90, padL = 24, padR = 6, padT = 4, padB = 18;
              const innerW = w - padL - padR, innerH = h - padT - padB;
              const max = Math.max(...timeChartData.map(d => d.count), 1);
              const points = timeChartData.map((d, i) => {
                const x = padL + (i / Math.max(timeChartData.length - 1, 1)) * innerW;
                const y = padT + innerH - (d.count / max) * innerH;
                return `${x},${y}`;
              }).join(" ");
              const steps = 4;
              const yLabels = Array.from({ length: steps + 1 }, (_, i) => Math.round((max / steps) * (steps - i)));
              return (
                <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto" }}>
                  {yLabels.map((v, i) => {
                    const y = padT + (i / steps) * innerH;
                    return (
                      <g key={i}>
                        <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="var(--gray-300)" strokeWidth={1} />
                        <text x={padL - 4} y={y + 3} textAnchor="end" fill="var(--gray-500)" fontSize={8}>{v}</text>
                      </g>
                    );
                  })}
                  <polyline points={points} fill="none" stroke="var(--gray-900)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  {timeChartData.map((d, i) => {
                    const x = padL + (i / Math.max(timeChartData.length - 1, 1)) * innerW;
                    const y = padT + innerH - (d.count / max) * innerH;
                    return d.count > 0 ? <circle key={i} cx={x} cy={y} r={2.5} fill="var(--gray-900)" /> : null;
                  })}
                  {timeChartData.filter((_, i) => {
                    const total = timeChartData.length;
                    if (total <= 7) return true;
                    const step = Math.ceil(total / 7);
                    return i % step === 0 || i === total - 1;
                  }).map((d, i, arr) => {
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
              <div style={{ fontSize: 11, color: "var(--gray-500)", padding: "40px 0", textAlign: "center" }}>No data</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
