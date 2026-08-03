import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { Map, AlertTriangle, MapPin, Search, ChevronLeft, ChevronRight, TrendingUp, CheckCircle, Clock, BarChart3 } from "lucide-react";

const ITEMS_PER_PAGE = 12;

const BARANGAYS = [
  "Bagacay", "Bantayan", "Binaliw", "Borobathon", "Cabilawan",
  "Canhabagat", "Caponayan", "Carayman", "Cogon", "Dalahican", "Danao",
  "Ginabuyan", "Jiabong", "Lagdagan", "Lalab", "Lampano", "Lantaw",
  "Lawaan", "Lonoy", "Lunao", "Mabini", "Malaga", "Malajog",
  "Maya", "Obrero", "Pajo", "Palanas", "Pangdan", "Rawis",
  "San Policarpo", "Santo Niño", "Tagumpay", "Tinambacan", "Tominamos", "Tugas",
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

export default function CrimeHeatmap() {
  const navigate = useNavigate();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const reportsRef = useRef<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapError, setMapError] = useState(false);
  const [barangayStats, setBarangayStats] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    reportsRef.current = reports;
  }, [reports]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("admin-crime-heatmap")
      .on("postgres_changes", { event: "*", schema: "public", table: "crime_reports" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (!mapRef.current) {
      initMap();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    if (!map.isStyleLoaded()) return;
    const source = map.getSource("crimes") as any;
    if (!source) return;

    const features = reports
      .filter((r) => r.latitude && r.longitude)
      .map((r) => ({
        type: "Feature" as const,
        properties: {
          id: r.id,
          crime_type: r.crime_type,
          status: r.status,
          time: new Date(r.created_at).toLocaleDateString(),
        },
        geometry: { type: "Point" as const, coordinates: [r.longitude, r.latitude] },
      }));

    source.setData({ type: "FeatureCollection", features });
  }, [reports]);

  const load = async () => {
    const { data } = await supabase
      .from("crime_reports")
      .select("id, crime_type, status, latitude, longitude, created_at, location_address")
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .limit(500);
    if (data) {
      setReports(data);
      computeBarangayStats(data);
    }
    setLoading(false);
  };

  const computeBarangayStats = (allReports: any[]) => {
    const stats: Record<string, { total: number; resolved: number; active: number }> = {};
    for (const name of BARANGAYS) {
      stats[name] = { total: 0, resolved: 0, active: 0 };
    }
    stats["Calbayog City"] = { total: 0, resolved: 0, active: 0 };

    for (const r of allReports) {
      const matched = getBarangay(r.location_address);
      if (!stats[matched]) stats[matched] = { total: 0, resolved: 0, active: 0 };
      stats[matched].total++;
      if (r.status === "resolved") stats[matched].resolved++;
      else stats[matched].active++;
    }

    setBarangayStats(
      Object.entries(stats)
        .map(([name, s]) => ({ name, ...s }))
        .sort((a, b) => b.total - a.total)
    );
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

      map.on("load", () => {
        const current = reportsRef.current;
        const features = current
          .filter((r) => r.latitude && r.longitude)
          .map((r) => ({
            type: "Feature" as const,
            properties: {
              id: r.id,
              crime_type: r.crime_type,
              status: r.status,
              time: new Date(r.created_at).toLocaleDateString(),
            },
            geometry: { type: "Point" as const, coordinates: [r.longitude, r.latitude] },
          }));

        map.addSource("crimes", {
          type: "geojson",
          data: { type: "FeatureCollection", features },
          cluster: true,
          clusterMaxZoom: 14,
          clusterRadius: 50,
        });

        map.addLayer({
          id: "clusters",
          type: "circle",
          source: "crimes",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": ["step", ["get", "point_count"], "#f4b51a", 5, "#f59e0b", 10, "#ef4444"],
            "circle-radius": ["step", ["get", "point_count"], 20, 5, 30, 10, 40],
            "circle-opacity": 0.7,
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
            "text-size": 12,
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
              ["==", ["get", "status"], "pending"], "#f4b51a",
              ["==", ["get", "status"], "in-progress"], "#2563eb",
              ["==", ["get", "status"], "needs-backup"], "#ef4444",
              ["==", ["get", "status"], "resolved"], "#10b981",
              "#94a3b8"
            ],
            "circle-radius": 8,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#fff",
          },
        });

        map.on("click", "clusters", (e: any) => {
          const feature = e.features[0];
          const clusterId = feature.properties.cluster_id;
          const source = map.getSource("crimes") as any;
          source.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
            if (!err) map.flyTo({ center: feature.geometry.coordinates, zoom });
          });
        });

        map.on("click", "points", (e: any) => {
          const feature = e.features[0];
          navigate(`/dashboard/reports/${feature.properties.id}`);
        });
      });

      map.on("error", () => setMapError(true));
    } catch {
      setMapError(true);
    }
  };

  const filtered = barangayStats.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()));
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const totalReports = barangayStats.reduce((s, b) => s + b.total, 0);
  const totalActive = barangayStats.reduce((s, b) => s + b.active, 0);
  const totalResolved = barangayStats.reduce((s, b) => s + b.resolved, 0);
  const barangaysWithIncidents = barangayStats.filter(b => b.total > 0).length;

  if (loading) return <div className="page-body"><div aria-label="Loading..." role="status" className="loader">
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
</div></div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - var(--header-height, 64px))", overflow: "hidden" }}>
      {/* Header */}
      <div className="page-header">
        <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Map size={18} /> Crime Heatmap & Barangays
        </h2>
      </div>

      {/* Summary Stats */}
      <div style={{ display: "flex", gap: 12, padding: "14px 24px", background: "var(--gray-50)", borderBottom: "1px solid var(--gray-300)", flexShrink: 0 }}>
        {[
          { label: "Total Reports", value: totalReports, icon: BarChart3, color: "#60a5fa", bg: "rgba(96,165,250,0.12)" },
          { label: "Active", value: totalActive, icon: Clock, color: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
          { label: "Resolved", value: totalResolved, icon: CheckCircle, color: "#34d399", bg: "rgba(52,211,153,0.12)" },
          { label: "Barangays", value: barangaysWithIncidents, icon: MapPin, color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
        ].map((s) => (
          <div key={s.label} style={{
            flex: 1, display: "flex", alignItems: "center", gap: 10,
            padding: "10px 14px", background: "var(--gray-100)",
            borderRadius: "var(--radius-md)", border: "1px solid rgba(255,255,255,0.06)",
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: "var(--radius-sm)",
              background: s.bg, display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <s.icon size={16} color={s.color} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--gray-500)", textTransform: "uppercase", letterSpacing: 0.3 }}>{s.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--gray-900)", lineHeight: 1.1, letterSpacing: -0.5 }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content: Map + Sidebar */}
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* Map */}
        <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
          <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />

          {/* Map Error */}
          {mapError && (
            <div style={{
              position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)",
              background: "rgba(239,68,68,0.95)", backdropFilter: "blur(8px)",
              color: "#fff", padding: "10px 20px", borderRadius: "var(--radius-md)",
              display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600,
              boxShadow: "0 4px 20px rgba(239,68,68,0.4)", zIndex: 10,
            }}>
              <AlertTriangle size={16} /> Map tiles could not be loaded
            </div>
          )}

          {/* Legend */}
          <div style={{
            position: "absolute", bottom: 16, left: 16,
            background: "rgba(20,20,20,0.92)", backdropFilter: "blur(12px)",
            borderRadius: "var(--radius-md)", padding: "12px 16px",
            border: "1px solid rgba(255,255,255,0.08)", zIndex: 10,
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--gray-400)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Status Legend</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { color: "#f4b51a", label: "Pending" },
                { color: "#2563eb", label: "In Progress" },
                { color: "#ef4444", label: "Needs Backup" },
                { color: "#10b981", label: "Resolved" },
              ].map((item) => (
                <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: item.color, boxShadow: `0 0 6px ${item.color}40`, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: "var(--gray-600)", fontWeight: 500 }}>{item.label}</span>
                </div>
              ))}
            </div>
            <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "8px 0" }} />
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--gray-400)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Clusters</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#f4b51a", opacity: 0.7 }} />
                <span style={{ fontSize: 10, color: "var(--gray-500)" }}>&lt;5</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#f59e0b", opacity: 0.7 }} />
                <span style={{ fontSize: 10, color: "var(--gray-500)" }}>5-10</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#ef4444", opacity: 0.7 }} />
                <span style={{ fontSize: 10, color: "var(--gray-500)" }}>&gt;10</span>
              </div>
            </div>
          </div>
        </div>

        {/* Barangay Sidebar */}
        <div style={{
          width: 380, flexShrink: 0, display: "flex", flexDirection: "column",
          background: "var(--gray-50)", borderLeft: "1px solid var(--gray-300)",
          overflow: "hidden",
        }}>
          {/* Sidebar Header */}
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--gray-300)", background: "var(--gray-100)", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <h3 style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "var(--gray-900)" }}>
                <MapPin size={15} /> Barangay Statistics
              </h3>
              <span className="badge" style={{ fontSize: 10, padding: "2px 8px" }}>{BARANGAYS.length} total</span>
            </div>
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--gray-400)" }} />
              <input
                className="search-input"
                style={{ fontSize: 12, padding: "8px 10px 8px 32px", width: "100%", boxSizing: "border-box" }}
                placeholder="Search barangay..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
          </div>

          {/* Barangay List */}
          <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
            {paginated.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--gray-400)" }}>
                <MapPin size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
                <p style={{ fontSize: 13, fontWeight: 500 }}>No barangay data found</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {paginated.map((b, idx) => {
                  const maxTotal = paginated[0]?.total || 1;
                  const barWidth = maxTotal > 0 ? (b.total / maxTotal) * 100 : 0;
                  const resolvedPercent = b.total > 0 ? Math.round((b.resolved / b.total) * 100) : 0;

                  return (
                    <div
                      key={b.name}
                      style={{
                        background: "var(--gray-100)", borderRadius: "var(--radius-sm)",
                        border: "1px solid rgba(255,255,255,0.06)", padding: "10px 12px",
                        transition: "all 0.15s ease", cursor: "default",
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.background = "var(--gray-200)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
                      onMouseOut={(e) => { e.currentTarget.style.background = "var(--gray-100)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--gray-900)" }}>{b.name}</span>
                        <span style={{
                          fontSize: 11, fontWeight: 800, color: b.total > 0 ? "var(--gray-900)" : "var(--gray-400)",
                          background: b.total > 0 ? "rgba(96,165,250,0.12)" : "rgba(255,255,255,0.04)",
                          padding: "2px 8px", borderRadius: 999, minWidth: 28, textAlign: "center",
                        }}>
                          {b.total}
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div style={{ height: 3, background: "var(--gray-200)", borderRadius: 2, marginBottom: 8, overflow: "hidden" }}>
                        <div style={{
                          height: "100%", width: `${barWidth}%`, borderRadius: 2,
                          background: b.active > 0 ? "linear-gradient(90deg, #f59e0b, #ef4444)" : "#10b981",
                          transition: "width 0.4s ease",
                        }} />
                      </div>

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", gap: 10, fontSize: 11 }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 3, color: "var(--gray-500)" }}>
                            <Clock size={11} style={{ color: "#fbbf24" }} /> {b.active}
                          </span>
                          <span style={{ display: "flex", alignItems: "center", gap: 3, color: "var(--gray-500)" }}>
                            <CheckCircle size={11} style={{ color: "#10b981" }} /> {b.resolved}
                          </span>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 600, color: resolvedPercent >= 50 ? "#10b981" : resolvedPercent > 0 ? "#fbbf24" : "var(--gray-400)" }}>
                          {resolvedPercent}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{
              padding: "10px 16px", borderTop: "1px solid var(--gray-300)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
              background: "var(--gray-100)", flexShrink: 0,
            }}>
              <button className="btn-ghost" style={{ padding: "4px 6px" }} disabled={page === 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i + 1}
                  className={page === i + 1 ? "btn-primary" : "btn-ghost"}
                  style={{ fontSize: 11, padding: "4px 8px", minWidth: 28 }}
                  onClick={() => setPage(i + 1)}
                >
                  {i + 1}
                </button>
              ))}
              <button className="btn-ghost" style={{ padding: "4px 6px" }} disabled={page === totalPages} onClick={() => setPage(page + 1)}>
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
