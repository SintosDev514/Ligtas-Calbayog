import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { useAlarm } from "../context/AlarmContext";
import {
  MapPin, Clock, Shield, Navigation, Search, User,
  Plus, Minus, Maximize2, PanelRightClose, PanelRightOpen,
  FileText, Phone, PhoneCall, Bell, AlertTriangle, X, Sun, Moon
} from "lucide-react";

interface OfficerData {
  officer_id: string;
  latitude: number;
  longitude: number;
  updated_at: string;
  report_id: string;
  officer: {
    id: string;
    full_name: string;
    badge_id: string;
    rank: string;
    station: string;
    photo_url: string | null;
    police_id_photo_url: string | null;
  } | null;
  report: {
    crime_type: string;
    status: string;
  } | null;
}

interface ResidentData {
  id: string;
  resident_id: string;
  latitude: number;
  longitude: number;
  location_address: string;
  crime_type: string;
  status: string;
  share_live_location: boolean;
  created_at: string;
  resident: {
    full_name: string;
    phone_number: string;
    address: string;
    photo_url: string | null;
    avatar_url: string | null;
  } | null;
}

interface ReportDetail {
  id: string;
  resident_id: string;
  crime_type: string;
  description: string;
  latitude: number;
  longitude: number;
  location_address: string;
  status: string;
  share_live_location: boolean;
  created_at: string;
  resident: {
    full_name: string;
    phone_number: string;
    address: string;
    photo_url: string | null;
    avatar_url: string | null;
  } | null;
  assigned_officers: {
    id: string;
    full_name: string;
    badge_id: string;
    rank: string;
    station: string;
    phone_number: string | null;
    photo_url: string | null;
  }[];
}

const REPORT_EMERGENCY_TYPES = ["emergency", "robbery", "assault", "hit-and-run", "burglary", "theft"];

export default function PoliceTracking() {
  const { alarmCount } = useAlarm();
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const [officers, setOfficers] = useState<OfficerData[]>([]);
  const [residents, setResidents] = useState<ResidentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapError, setMapError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "police" | "residents">("all");
  const [showSidebar, setShowSidebar] = useState(false);
  const [showReportPanel, setShowReportPanel] = useState(false);
  const [reports, setReports] = useState<ReportDetail[]>([]);
  const [focusedReportId, setFocusedReportId] = useState<string | null>(null);
  const [mapStyle, setMapStyle] = useState("liberty");
  const satelliteStyle: any = {
    version: 8,
    sources: {
      "satellite": {
        type: "raster",
        tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
        tileSize: 256,
        attribution: "Esri",
      },
    },
    layers: [{ id: "satellite-layer", type: "raster", source: "satellite" }],
  };

  const mapStyles = [
    { id: "liberty", label: "Light", url: "https://tiles.openfreemap.org/styles/liberty", icon: Sun },
    { id: "dark", label: "Dark", url: "https://tiles.openfreemap.org/styles/dark", icon: Moon },
    { id: "satellite", label: "Satellite", url: satelliteStyle, icon: MapPin },
  ];
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const maplibreglRef = useRef<any>(null);
  const officersRef = useRef<OfficerData[]>([]);
  const residentsRef = useRef<ResidentData[]>([]);
  const activeTabRef = useRef<"all" | "police" | "residents">("all");
  const focusedReportIdRef = useRef<string | null>(null);

  const loadAllReports = useCallback(async () => {
    try {
      const { data: reportsData } = await supabase
        .from("crime_reports")
        .select("id, resident_id, crime_type, description, latitude, longitude, location_address, status, share_live_location, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      const residentIds = [...new Set((reportsData ?? []).map((r: any) => r.resident_id))];

      const profileMap: Record<string, any> = {};
      if (residentIds.length > 0) {
        const { data: profiles } = await supabase
          .from("resident_profiles")
          .select("id, full_name, phone_number, address, photo_url, avatar_url")
          .in("id", residentIds);
        for (const p of profiles ?? []) profileMap[p.id] = p;
      }

      const reportIds = (reportsData ?? []).map((r: any) => r.id);

      const officerMap: Record<string, any[]> = {};
      if (reportIds.length > 0) {
        const { data: locs } = await supabase
          .from("police_locations")
          .select("officer_id, report_id")
          .in("report_id", reportIds)
          .not("report_id", "is", null);

        const officerIds = [...new Set((locs ?? []).map((l: any) => l.officer_id))];

        const { data: pProfiles } = await supabase
          .from("police_profiles")
          .select("id, full_name, badge_id, rank, station, phone_number, photo_url")
          .in("id", officerIds);

        const pMap: Record<string, any> = {};
        for (const p of pProfiles ?? []) pMap[p.id] = p;

        for (const loc of locs ?? []) {
          if (!officerMap[loc.report_id]) officerMap[loc.report_id] = [];
          const pp = pMap[loc.officer_id];
          if (pp && !officerMap[loc.report_id].find((o: any) => o.id === pp.id)) {
            officerMap[loc.report_id].push(pp);
          }
        }
      }

      const result: ReportDetail[] = (reportsData ?? []).map((r: any) => ({
        ...r,
        resident: profileMap[r.resident_id] || null,
        assigned_officers: officerMap[r.id] || [],
      }));

      setReports(result);
    } catch (err) {
      console.error("Failed to load reports:", err);
    }
  }, []);

  useEffect(() => {
    Promise.all([loadOfficers(), loadResidents()]).then(([oData, rData]) => {
      officersRef.current = oData;
      residentsRef.current = rData;
      setOfficers(oData);
      setResidents(rData);
      loadAllReports();
      initMap();
    });

    const channel = supabase
      .channel("admin-ops-map")
      .on("postgres_changes", { event: "*", schema: "public", table: "police_locations" }, () => {
        loadOfficers().then((oData) => {
          officersRef.current = oData;
          setOfficers(oData);
          if (mapRef.current) addAllMarkers();
          loadAllReports();
        });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "crime_reports" }, (payload: any) => {
        loadAllReports();
        loadResidents().then((rData) => {
          residentsRef.current = rData;
          setResidents(rData);
          if (mapRef.current) addAllMarkers();
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "crime_reports" }, () => {
        loadAllReports();
        loadResidents().then((rData) => {
          residentsRef.current = rData;
          setResidents(rData);
          if (mapRef.current) addAllMarkers();
        });
      })
      .subscribe((status: string) => {
        console.log("[realtime] admin-ops-map status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markersRef.current = [];
    };
  }, [loadAllReports]);

  async function loadOfficers() {
    try {
      const { data: locations } = await supabase
        .from("police_locations")
        .select("officer_id, latitude, longitude, updated_at, report_id, report:crime_reports!report_id(crime_type, status)")
        .order("updated_at", { ascending: false });

      const officerIds = [...new Set((locations ?? []).map((l: any) => l.officer_id))];

      const profileMap: Record<string, any> = {};
      if (officerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("police_profiles")
          .select("id, full_name, badge_id, rank, station, photo_url, police_id_photo_url")
          .in("id", officerIds);
        for (const p of profiles ?? []) profileMap[p.id] = p;
      }

      const latestPerOfficer: Record<string, any> = {};
      for (const loc of locations ?? []) {
        const oid = loc.officer_id;
        if (!latestPerOfficer[oid] || new Date(loc.updated_at) > new Date(latestPerOfficer[oid].updated_at)) {
          latestPerOfficer[oid] = loc;
        }
      }

      return Object.entries(latestPerOfficer).map(([oid, loc]) => ({
        ...loc,
        officer: profileMap[oid] || null,
      })) as OfficerData[];
    } catch (err) {
      console.error("Failed to load officers:", err);
      return [];
    } finally {
      setLoading(false);
    }
  }

  async function loadResidents() {
    try {
      const { data: reports } = await supabase
        .from("crime_reports")
        .select("id, resident_id, latitude, longitude, location_address, crime_type, status, share_live_location, created_at")
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .order("created_at", { ascending: false });

      const residentIds = [...new Set((reports ?? []).map((r: any) => r.resident_id))];

      const profileMap: Record<string, any> = {};
      if (residentIds.length > 0) {
        const { data: profiles } = await supabase
          .from("resident_profiles")
          .select("id, full_name, phone_number, address, photo_url, avatar_url")
          .in("id", residentIds);
        for (const p of profiles ?? []) profileMap[p.id] = p;
      }

      const latestPerResident: Record<string, any> = {};
      for (const r of reports ?? []) {
        const rid = r.resident_id;
        if (!latestPerResident[rid] || new Date(r.created_at) > new Date(latestPerResident[rid].created_at)) {
          latestPerResident[rid] = r;
        }
      }

      return Object.entries(latestPerResident).map(([rid, r]) => ({
        ...r,
        resident: profileMap[rid] || null,
      })) as ResidentData[];
    } catch (err) {
      console.error("Failed to load residents:", err);
      return [];
    } finally {
      setLoading(false);
    }
  }

  async function initMap() {
    try {
      const maplibregl = await import("maplibre-gl");
      maplibreglRef.current = maplibregl;

      const container = document.getElementById("tracking-map");
      if (!container) return;

      const initialStyle = mapStyles.find((s) => s.id === mapStyle);
      const map = new maplibregl.Map({
        container,
        style: initialStyle ? initialStyle.url : "https://tiles.openfreemap.org/styles/liberty",
        center: [124.6, 12.066],
        zoom: 12,
      });

      mapRef.current = map;

      map.on("load", () => addAllMarkers());
      map.on("error", () => setMapError(true));
    } catch {
      setMapError(true);
    }
  }

  function toggleMapStyle() {
    const ids = mapStyles.map((s) => s.id);
    const idx = ids.indexOf(mapStyle);
    const next = ids[(idx + 1) % ids.length];
    setMapStyle(next);
    if (mapRef.current) {
      const s = mapStyles.find((s) => s.id === next);
      if (s) mapRef.current.setStyle(s.url);
    }
  }

  useEffect(() => {
    activeTabRef.current = activeTab;
    addAllMarkers();
  }, [activeTab]);

  useEffect(() => {
    focusedReportIdRef.current = focusedReportId;
    addAllMarkers();
  }, [focusedReportId]);

  function addAllMarkers() {
    const maplibregl = maplibreglRef.current;
    if (!maplibregl || !mapRef.current) return;

    for (const m of markersRef.current) m.remove();
    markersRef.current = [];

    const tab = activeTabRef.current;
    const focus = focusedReportIdRef.current;
    const showPolice = (tab === "all" || tab === "police") && !focus;
    const showResidents = tab === "all" || tab === "residents";

    if (focus) {
      for (const off of officersRef.current) {
        if (off.latitude == null || off.longitude == null) continue;
        if (off.report_id !== focus && !off.report_id?.includes(focus)) continue;

        const isActive = Date.now() - new Date(off.updated_at).getTime() < 5 * 60 * 1000;

        const el = document.createElement("div");
        el.className = `officer-marker${isActive ? " active" : ""}`;

        const picUrl = off.officer?.photo_url || off.officer?.police_id_photo_url;
        if (picUrl) {
          const img = document.createElement("img");
          img.src = picUrl;
          img.alt = off.officer?.full_name?.charAt(0) || "P";
          img.style.cssText = "width:100%;height:100%;border-radius:50%;object-fit:cover;";
          el.appendChild(img);
        } else {
          el.textContent = off.officer?.full_name?.charAt(0) || "?";
        }

        const popup = new maplibregl.Popup({ offset: 25 }).setHTML(`
          <div class="popup-content">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
              <span style="width:8px;height:8px;border-radius:50%;background:${isActive ? "#22c55e" : "#d97706"}"></span>
              <h4 style="margin:0">${off.officer?.full_name || "Unknown Officer"}</h4>
            </div>
            <p>Badge: ${off.officer?.badge_id || "—"}</p>
            <p>Rank: ${off.officer?.rank || "—"}</p>
            <p>Station: ${off.officer?.station || "—"}</p>
            ${off.report ? `<p>Responding to: ${off.report.crime_type?.replace(/-/g, " ")} (${off.report.status})</p>` : ""}
            <p style="color: var(--gray-400); font-size: 11px; margin-top: 4px;">
              Updated: ${new Date(off.updated_at).toLocaleTimeString()}
            </p>
          </div>
        `);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([off.longitude, off.latitude])
          .setPopup(popup)
          .addTo(mapRef.current);

        markersRef.current.push(marker);
      }
    }

    if (showPolice) for (const off of officersRef.current) {
      if (off.latitude == null || off.longitude == null) continue;

      const isActive = Date.now() - new Date(off.updated_at).getTime() < 5 * 60 * 1000;

      const el = document.createElement("div");
      el.className = `officer-marker${isActive ? " active" : ""}`;

      const picUrl = off.officer?.photo_url || off.officer?.police_id_photo_url;
      if (picUrl) {
        const img = document.createElement("img");
        img.src = picUrl;
        img.alt = off.officer?.full_name?.charAt(0) || "P";
        img.style.cssText = "width:100%;height:100%;border-radius:50%;object-fit:cover;";
        el.appendChild(img);
      } else {
        el.textContent = off.officer?.full_name?.charAt(0) || "?";
      }

      const popup = new maplibregl.Popup({ offset: 25 }).setHTML(`
        <div class="popup-content">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <span style="width:8px;height:8px;border-radius:50%;background:${isActive ? "#22c55e" : "#d97706"}"></span>
            <h4 style="margin:0">${off.officer?.full_name || "Unknown Officer"}</h4>
          </div>
          <p>Badge: ${off.officer?.badge_id || "—"}</p>
          <p>Rank: ${off.officer?.rank || "—"}</p>
          <p>Station: ${off.officer?.station || "—"}</p>
          ${off.report ? `<p>Responding to: ${off.report.crime_type?.replace(/-/g, " ")} (${off.report.status})</p>` : ""}
          <p style="color: var(--gray-400); font-size: 11px; margin-top: 4px;">
            Updated: ${new Date(off.updated_at).toLocaleTimeString()}
          </p>
        </div>
      `);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([off.longitude, off.latitude])
        .setPopup(popup)
        .addTo(mapRef.current);

      markersRef.current.push(marker);
    }

    if (showResidents) for (const r of residentsRef.current) {
      if (r.latitude == null || r.longitude == null) continue;
      if (focus && r.id !== focus) continue;

      const isRecent = Date.now() - new Date(r.created_at).getTime() < 24 * 60 * 60 * 1000;

      const el = document.createElement("div");
      el.className = `resident-marker${isRecent ? " active" : ""}`;

      const picUrl = r.resident?.photo_url || r.resident?.avatar_url;
      if (picUrl) {
        const img = document.createElement("img");
        img.src = picUrl;
        img.alt = r.resident?.full_name?.charAt(0) || "R";
        img.style.cssText = "width:100%;height:100%;border-radius:50%;object-fit:cover;";
        el.appendChild(img);
      } else {
        el.textContent = r.resident?.full_name?.charAt(0) || "?";
      }

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([r.longitude, r.latitude])
        .addTo(mapRef.current);

      el.style.cursor = "pointer";
      el.addEventListener("click", () => {
        navigateRef.current(`/reports/${r.id}`);
      });

      markersRef.current.push(marker);
    }
  }

  const formatTime = (d: string) =>
    new Date(d).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  function flyTo(lat: number, lng: number) {
    if (!mapRef.current) return;
    mapRef.current.flyTo({ center: [lng, lat], zoom: 15, duration: 1000 });
  }

  function zoomIn() {
    if (!mapRef.current) return;
    mapRef.current.zoomIn({ duration: 300 });
  }

  function zoomOut() {
    if (!mapRef.current) return;
    mapRef.current.zoomOut({ duration: 300 });
  }

  function toggleFullscreen() {
    const el = document.querySelector(".tracking-fullscreen");
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen();
    }
  }

  function filterList(items: any[], type: "officer" | "resident") {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter((item: any) => {
      if (type === "officer") {
        const name = item.officer?.full_name?.toLowerCase() || "";
        const badge = item.officer?.badge_id?.toLowerCase() || "";
        const rank = item.officer?.rank?.toLowerCase() || "";
        const station = item.officer?.station?.toLowerCase() || "";
        return name.includes(q) || badge.includes(q) || rank.includes(q) || station.includes(q);
      }
      const name = item.resident?.full_name?.toLowerCase() || "";
      const addr = item.resident?.address?.toLowerCase() || "";
      const crime = item.crime_type?.toLowerCase() || "";
      return name.includes(q) || addr.includes(q) || crime.includes(q);
    });
  }

  if (loading) {
    return (
      <div className="page-body" style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
        <div className="honeycomb"><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div>
      </div>
    );
  }

  const filteredOfficers = filterList(officers, "officer") as OfficerData[];
  const filteredResidents = filterList(residents, "resident") as ResidentData[];
  const totalMarkers = officers.length + residents.length;

  return (
    <div className="tracking-fullscreen">
      <div id="tracking-map" className="tracking-map" />
      {mapError && (
        <div style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)",
          color: "#fff", gap: 12, zIndex: 1
        }}>
          <MapPin size={32} />
          <p>Map failed to load — check your internet connection</p>
        </div>
      )}
      <div className="tracking-left-bar">
        <div className="left-bar-label">Operations Map</div>
        <div className="left-bar-item">
          <button className="left-bar-btn" onClick={zoomIn} title="Zoom in">
            <Plus size={18} />
          </button>
          <span className="left-bar-item-label">Zoom In</span>
        </div>
        <div className="left-bar-item">
          <button className="left-bar-btn" onClick={zoomOut} title="Zoom out">
            <Minus size={18} />
          </button>
          <span className="left-bar-item-label">Zoom Out</span>
        </div>
        <div className="left-bar-divider" />
        <div className="left-bar-item">
          <button
            className={`left-bar-btn${showReportPanel ? " active" : ""}`}
            onClick={() => setShowReportPanel(!showReportPanel)}
            title="Reports"
          >
            <FileText size={16} />
            {alarmCount > 0 && <span className="left-bar-badge">{alarmCount}</span>}
          </button>
          <span className="left-bar-item-label">Reports</span>
        </div>
        <div className="left-bar-item">
          <button className="left-bar-btn" onClick={toggleFullscreen} title="Fullscreen">
            <Maximize2 size={16} />
          </button>
          <span className="left-bar-item-label">Fullscreen</span>
        </div>
        <div className="left-bar-item">
          {(() => {
            const ids = mapStyles.map((s) => s.id);
            const idx = ids.indexOf(mapStyle);
            const next = mapStyles[(idx + 1) % ids.length];
            const NextIcon = next.icon;
            return (
              <>
                <button className="left-bar-btn" onClick={toggleMapStyle} title={`Switch to ${next.label} map`}>
                  <NextIcon size={16} />
                </button>
                <span className="left-bar-item-label">{next.label}</span>
              </>
            );
          })()}
        </div>
        <div className="left-bar-divider" />
        <div className="left-bar-item">
          <button className="left-bar-btn" onClick={() => setShowSidebar(!showSidebar)} title="Toggle directory">
            {showSidebar ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
          </button>
          <span className="left-bar-item-label">Directory</span>
        </div>
      </div>

      {showReportPanel && (
        <div className="report-panel">
          <div className="report-panel-header">
            <h3><FileText size={16} /> Reports</h3>
            <button className="report-panel-close" onClick={() => setShowReportPanel(false)}>
              <X size={16} />
            </button>
          </div>
          <div className="report-panel-list">
            {reports.length > 0 ? reports.map((r) => {
              const isEmergency = REPORT_EMERGENCY_TYPES.includes(r.crime_type?.toLowerCase());
        const isPending = r.status === "pending";
              return (
                <div key={r.id} className={`report-card${focusedReportId === r.id ? " focused" : ""}`} onClick={() => { setFocusedReportId(r.id); if (r.latitude) flyTo(r.latitude, r.longitude); }}>
                  <div className="report-card-top">
                    <div className="report-card-title">
                      {isEmergency && isPending && <AlertTriangle size={14} className="report-emergency-icon" />}
                      <span className="report-crime-type">{r.crime_type?.replace(/-/g, " ")}</span>
                      <span className={`badge badge-${r.status}`}>{r.status}</span>
                    </div>
                    <span className="report-date">{formatDate(r.created_at)}</span>
                  </div>
                  <div className="report-card-resident">
                    <User size={12} />
                    <span>{r.resident?.full_name || "Unknown"}</span>
                    {r.resident?.phone_number && (
                      <a href={`tel:${r.resident.phone_number}`} className="report-contact-link" onClick={(e) => e.stopPropagation()} title="Call resident">
                        <Phone size={12} />
                      </a>
                    )}
                  </div>
                  {r.location_address && (
                    <div className="report-card-address">
                      <MapPin size={12} />
                      {r.location_address}
                    </div>
                  )}
                  {r.assigned_officers.length > 0 && (
                    <div className="report-card-officers">
                      <Shield size={12} />
                      {r.assigned_officers.map((o) => (
                        <span key={o.id} className="report-officer-tag">
                          {o.full_name}
                          {o.phone_number && (
                            <a href={`tel:${o.phone_number}`} className="report-contact-link" onClick={(e) => e.stopPropagation()} title="Call officer">
                              <PhoneCall size={11} />
                            </a>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            }) : (
              <div className="empty-state" style={{ padding: 20 }}>
                <h3>No Reports</h3>
                <p>No reports available</p>
              </div>
            )}
          </div>
        </div>
      )}

      {showSidebar && <div className="tracking-overlay-sidebar">
        <div className="sidebar-header">
          <div className="sidebar-header-title">
            <MapPin size={14} />
            <span>Directory</span>
          </div>
          <button className="sidebar-header-close" onClick={() => setShowSidebar(false)}>
            <X size={14} />
          </button>
        </div>
        <div className="tracking-tabs">
          <button className={`tracking-tab${activeTab === "all" ? " active" : ""}`} onClick={() => setActiveTab("all")}>
            All <span className="tab-count">{totalMarkers}</span>
          </button>
          <button className={`tracking-tab${activeTab === "police" ? " active" : ""}`} onClick={() => setActiveTab("police")}>
            Police <span className="tab-count">{officers.length}</span>
          </button>
          <button className={`tracking-tab${activeTab === "residents" ? " active" : ""}`} onClick={() => setActiveTab("residents")}>
            Residents <span className="tab-count">{residents.length}</span>
          </button>
        </div>
        <div className="tracking-search">
          <Search size={14} />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="search-clear" onClick={() => setSearchQuery("")}>
              <X size={12} />
            </button>
          )}
        </div>
        <div className="tracking-sidebar-scroll">
          {activeTab !== "residents" && (
            <>
              {activeTab === "all" && officers.length > 0 && (
                <div className="tracking-section-label">
                  <Shield size={12} />
                  Police Officers
                </div>
              )}
              {filteredOfficers.length > 0 ? (
                <div className="tracking-sidebar-list">
                  {filteredOfficers.map((off) => {
                    const isActive = Date.now() - new Date(off.updated_at).getTime() < 5 * 60 * 1000;
                    return (
                      <div key={off.officer_id} className="officer-card" onClick={() => flyTo(off.latitude, off.longitude)}>
                        <div className="officer-card-content">
                          <div className={`officer-avatar${isActive ? " active" : " away"}`}>
                            {(() => {
                              const picUrl = off.officer?.photo_url || off.officer?.police_id_photo_url;
                              return picUrl
                                ? <img src={picUrl} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                                : (off.officer?.full_name?.charAt(0) || "?");
                            })()}
                          </div>
                          <div className="officer-info">
                            <div className="officer-name">
                              {off.officer?.full_name || "Unknown"}
                            </div>
                            <div className="officer-details">
                              {off.officer?.rank} · {off.officer?.station}
                            </div>
                            <div className="officer-time">
                              <Clock size={11} />
                              {formatTime(off.updated_at)}
                            </div>
                          </div>
                          <div className={`officer-status-dot${isActive ? " online" : " offline"}`} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                officers.length > 0 && (
                  <div className="empty-state" style={{ padding: "12px 0" }}>
                    <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>No police match your search</p>
                  </div>
                )
              )}
            </>
          )}

          {activeTab !== "police" && (
            <>
              {activeTab === "all" && residents.length > 0 && (
                <div className="tracking-section-label" style={{ marginTop: 8 }}>
                  <User size={12} />
                  Residents with Reports
                </div>
              )}
              {filteredResidents.length > 0 ? (
                <div className="tracking-sidebar-list">
                  {filteredResidents.map((r) => {
                    const isRecent = Date.now() - new Date(r.created_at).getTime() < 24 * 60 * 60 * 1000;
                    return (
                      <div key={r.id} className="officer-card" onClick={() => flyTo(r.latitude, r.longitude)}>
                        <div className="officer-card-content">
                          <div className={`resident-avatar${isRecent ? " active" : ""}`}>
                            {(() => {
                              const picUrl = r.resident?.photo_url || r.resident?.avatar_url;
                              return picUrl
                                ? <img src={picUrl} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                                : (r.resident?.full_name?.charAt(0) || "?");
                            })()}
                          </div>
                          <div className="officer-info">
                            <div className="officer-name">
                              {r.resident?.full_name || "Unknown"}
                            </div>
                            <div className="officer-details">
                              {r.resident?.phone_number || "—"} · {(r.resident?.address || "").split(",")[0] || "—"}
                            </div>
                            <div className="officer-time">
                              <Clock size={11} />
                              {formatDate(r.created_at)}
                            </div>
                          </div>
                          <div className={`officer-status-dot${r.share_live_location ? " online" : " offline"}`} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                residents.length > 0 && (
                  <div className="empty-state" style={{ padding: "12px 0" }}>
                    <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>No residents match your search</p>
                  </div>
                )
              )}
            </>
          )}

          {activeTab === "all" && officers.length === 0 && residents.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon"><MapPin size={20} /></div>
              <h3>No Data</h3>
              <p>No officers or resident reports available</p>
            </div>
          )}
          {activeTab === "police" && officers.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon"><MapPin size={20} /></div>
              <h3>No Officers</h3>
              <p>No police location data available</p>
            </div>
          )}
          {activeTab === "residents" && residents.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon"><MapPin size={20} /></div>
              <h3>No Residents</h3>
              <p>No recent resident reports with location data</p>
            </div>
          )}
        </div>
      </div>}
    </div>
  );
}
