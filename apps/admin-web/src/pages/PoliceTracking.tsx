import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { useAlarm } from "../context/AlarmContext";
import {
  MapPin, Clock, Shield, Navigation, Search, User,
  Plus, Minus, Maximize2, PanelRightClose, PanelRightOpen,
  FileText, Phone, PhoneCall, Bell, AlertTriangle, X, Sun, Moon, Globe
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

interface PolicePost {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string | null;
  officers: { id: string; full_name: string; badge_id: string; rank: string }[];
}

interface OfficerRoute {
  officer_id: string;
  coordinates: [number, number][];
}

const REPORT_EMERGENCY_TYPES = ["emergency", "robbery", "assault", "hit-and-run", "burglary", "theft"];

const CRIME_COLORS: Record<string, string> = {
  emergency: "#ef4444",
  robbery: "#f97316",
  assault: "#dc2626",
  "hit-and-run": "#f59e0b",
  burglary: "#a855f7",
  theft: "#3b82f6",
  fire: "#ff6b35",
  accident: "#f43f5e",
};

const ACTIVE_STATUSES = ["pending", "under-review", "in-progress", "dispatched"];

function getCrimeColor(type: string): string {
  return CRIME_COLORS[type?.toLowerCase()] || "#6b7280";
}

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
  const [mapStyle, setMapStyle] = useState("mapbox-dark");

  const mapStyles = [
    { id: "mapbox-dark", label: "Dark", url: "mapbox://styles/mapbox/dark-v11", icon: Moon },
    { id: "mapbox-light", label: "Light", url: "mapbox://styles/mapbox/light-v11", icon: Sun },
    { id: "mapbox-satellite-streets", label: "Satellite", url: "mapbox://styles/mapbox/satellite-streets-v12", icon: Globe },
  ];
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const mapboxglRef = useRef<any>(null);
  const officersRef = useRef<OfficerData[]>([]);
  const residentsRef = useRef<ResidentData[]>([]);
  const activeTabRef = useRef<"all" | "police" | "residents">("all");
  const focusedReportIdRef = useRef<string | null>(null);
  const [policePosts, setPolicePosts] = useState<PolicePost[]>([]);
  const policePostsRef = useRef<PolicePost[]>([]);
  const [placingPost, setPlacingPost] = useState(false);
  const placingPostRef = useRef(false);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [postPlaceLat, setPostPlaceLat] = useState<number | null>(null);
  const [postPlaceLng, setPostPlaceLng] = useState<number | null>(null);
  const [postName, setPostName] = useState("");
  const [allOfficers, setAllOfficers] = useState<any[]>([]);
  const [selectedOfficers, setSelectedOfficers] = useState<Set<string>>(new Set());
  const [officerSearch, setOfficerSearch] = useState("");
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [officerRoutes, setOfficerRoutes] = useState<OfficerRoute[]>([]);
  const officerRoutesRef = useRef<OfficerRoute[]>([]);
  const [showRoutes, setShowRoutes] = useState(true);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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
    Promise.all([loadOfficers(), loadResidents(), loadPolicePosts(), loadAllOfficers()]).then(([oData, rData, pData, aData]) => {
      officersRef.current = oData;
      residentsRef.current = rData;
      policePostsRef.current = pData;
      setOfficers(oData);
      setResidents(rData);
      setPolicePosts(pData);
      setAllOfficers(aData);
      loadAllReports();
      initMap();
      loadOfficerRoutes();
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
        loadOfficerRoutes();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "police_location_history" }, () => {
        loadOfficerRoutes();
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
      .on("postgres_changes", { event: "*", schema: "public", table: "police_posts" }, () => {
        loadPolicePosts().then((pData) => {
          policePostsRef.current = pData;
          setPolicePosts(pData);
          if (mapRef.current) addAllMarkers();
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "police_post_assignments" }, () => {
        loadPolicePosts().then((pData) => {
          policePostsRef.current = pData;
          setPolicePosts(pData);
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

  useEffect(() => {
    placingPostRef.current = placingPost;
  }, [placingPost]);

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
        .in("status", ACTIVE_STATUSES)
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

  async function loadPolicePosts() {
    try {
      const { data } = await supabase
        .from("police_posts")
        .select("id, name, latitude, longitude, address")
        .order("name");
      const posts = (data ?? []) as PolicePost[];

      const postIds = posts.map((p) => p.id);
      const assignmentsMap: Record<string, any[]> = {};
      if (postIds.length > 0) {
        const { data: assigns } = await supabase
          .from("police_post_assignments")
          .select("post_id, officer:police_profiles!officer_id(id, full_name, badge_id, rank)")
          .in("post_id", postIds);
        for (const a of assigns ?? []) {
          if (!assignmentsMap[a.post_id]) assignmentsMap[a.post_id] = [];
          if (a.officer) assignmentsMap[a.post_id].push(a.officer);
        }
      }

      return posts.map((p) => ({ ...p, officers: assignmentsMap[p.id] || [] }));
    } catch (err) {
      console.error("Failed to load police posts:", err);
      return [];
    }
  }

  async function loadAllOfficers() {
    try {
      const { data } = await supabase
        .from("police_profiles")
        .select("id, full_name, badge_id, rank")
        .order("full_name");
      return data ?? [];
    } catch (err) {
      console.error("Failed to load officers:", err);
      return [];
    }
  }

  async function loadOfficerRoutes() {
    try {
      const recent = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("police_location_history")
        .select("officer_id, latitude, longitude, created_at")
        .gte("created_at", recent)
        .order("created_at", { ascending: true });

      const grouped: Record<string, [number, number][]> = {};
      for (const row of data ?? []) {
        if (!grouped[row.officer_id]) grouped[row.officer_id] = [];
        grouped[row.officer_id].push([row.longitude, row.latitude]);
      }

      const routes: OfficerRoute[] = Object.entries(grouped)
        .filter(([, coords]) => coords.length >= 2)
        .map(([officer_id, coords]) => ({
          officer_id,
          coordinates: coords.slice(-200),
        }));

      officerRoutesRef.current = routes;
      setOfficerRoutes(routes);
      updateRouteLines();
    } catch (err) {
      console.error("Failed to load officer routes:", err);
    }
  }

  function updateRouteLines() {
    const map = mapRef.current;
    if (!map || !map.getSource) return;

    try {
      if (map.getLayer("officer-routes-glow")) map.removeLayer("officer-routes-glow");
      if (map.getLayer("officer-routes-line")) map.removeLayer("officer-routes-line");
      if (map.getSource("officer-routes")) map.removeSource("officer-routes");
    } catch {}

    const routes = officerRoutesRef.current;
    if (routes.length === 0) return;

    const features = routes.map((r) => ({
      type: "Feature" as const,
      properties: { officer_id: r.officer_id },
      geometry: { type: "LineString" as const, coordinates: r.coordinates },
    }));

    map.addSource("officer-routes", {
      type: "geojson",
      data: { type: "FeatureCollection", features },
    });

    map.addLayer({
      id: "officer-routes-glow",
      type: "line",
      source: "officer-routes",
      paint: {
        "line-color": "#22c55e",
        "line-width": 8,
        "line-opacity": 0.15,
        "line-blur": 3,
      },
    });

    map.addLayer({
      id: "officer-routes-line",
      type: "line",
      source: "officer-routes",
      paint: {
        "line-color": "#22c55e",
        "line-width": 2.5,
        "line-opacity": 0.7,
      },
    });
  }

  function openEditPost(post: PolicePost) {
    setEditingPostId(post.id);
    setPostName(post.name);
    setPostPlaceLat(post.latitude);
    setPostPlaceLng(post.longitude);
    setSelectedOfficers(new Set(post.officers?.map((o) => o.id) || []));
    setOfficerSearch("");
    setPlacingPost(false);
    setIsPostModalOpen(true);
  }

  async function submitPost() {
    if (!postName.trim() || postPlaceLat == null || postPlaceLng == null) return;
    try {
      if (editingPostId) {
        await supabase.from("police_posts").update({
          name: postName.trim(),
          latitude: postPlaceLat,
          longitude: postPlaceLng,
          updated_at: new Date().toISOString(),
        }).eq("id", editingPostId);
        await syncAssignments(editingPostId);
      } else {
        const { data: inserted } = await supabase.from("police_posts").insert({
          name: postName.trim(),
          latitude: postPlaceLat,
          longitude: postPlaceLng,
        }).select("id").single();
        if (inserted) await syncAssignments(inserted.id);
      }
      resetPostModal();
      const pData = await loadPolicePosts();
      policePostsRef.current = pData;
      setPolicePosts(pData);
      if (mapRef.current) addAllMarkers();
    } catch (err) {
      console.error("Failed to save police post:", err);
    }
  }

  async function syncAssignments(postId: string) {
    const { data: existing } = await supabase
      .from("police_post_assignments")
      .select("officer_id")
      .eq("post_id", postId);
    const existingIds = new Set((existing ?? []).map((a) => a.officer_id));
    const toAdd = [...selectedOfficers].filter((id) => !existingIds.has(id));
    const toRemove = [...existingIds].filter((id) => !selectedOfficers.has(id));
    if (toRemove.length > 0) {
      await supabase.from("police_post_assignments").delete().eq("post_id", postId).in("officer_id", toRemove);
    }
    if (toAdd.length > 0) {
      await supabase.from("police_post_assignments").insert(toAdd.map((officer_id) => ({ post_id: postId, officer_id })));
    }
  }

  function resetPostModal() {
    setPostName("");
    setPostPlaceLat(null);
    setPostPlaceLng(null);
    setSelectedOfficers(new Set());
    setOfficerSearch("");
    setEditingPostId(null);
    setIsPostModalOpen(false);
    setPlacingPost(false);
  }

  async function deletePost() {
    if (!editingPostId) return;
    try {
      await supabase.from("police_posts").delete().eq("id", editingPostId);
      resetPostModal();
      const pData = await loadPolicePosts();
      policePostsRef.current = pData;
      setPolicePosts(pData);
      if (mapRef.current) addAllMarkers();
    } catch (err) {
      console.error("Failed to delete police post:", err);
    }
  }

  async function initMap() {
    try {
      const mapboxgl = await import("mapbox-gl");
      mapboxglRef.current = mapboxgl;
      const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string;
      if (!token) {
        console.error("Mapbox token is missing — check .env file");
        setMapError(true);
        return;
      }
      mapboxgl.accessToken = token;

      const container = document.getElementById("tracking-map");
      if (!container) return;

      const initialStyle = mapStyles.find((s) => s.id === mapStyle);
      const map = new mapboxgl.Map({
        container,
        style: initialStyle ? initialStyle.url : "mapbox://styles/mapbox/dark-v11",
        center: [124.6, 12.066],
        zoom: 14,
        pitch: 45,
        bearing: -17.6,
        antialias: true,
        accessToken: token,
      });

      mapRef.current = map;

      map.on("load", () => {
        add3DBuildings(map);
        addAllMarkers();
        updateRouteLines();
      });

      map.on("click", (e: any) => {
        if (placingPostRef.current) {
          setPostPlaceLat(e.lngLat.lat);
          setPostPlaceLng(e.lngLat.lng);
          setIsPostModalOpen(true);
        }
      });

      map.on("error", (e: any) => {
        console.error("Mapbox error:", e?.error?.message || e);
        setMapError(true);
      });
    } catch (e) {
      console.error("Mapbox init error:", e);
      setMapError(true);
    }
  }

  function add3DBuildings(map: any) {
    const layers = map.getStyle().layers;
    let labelLayerId: string | undefined;
    for (const layer of layers) {
      if (layer.type === "symbol" && layer.layout?.["text-field"]) {
        labelLayerId = layer.id;
        break;
      }
    }

    if (map.getLayer("3d-buildings")) return;

    map.addLayer(
      {
        id: "3d-buildings",
        source: "composite",
        "source-layer": "building",
        type: "fill-extrusion",
        minzoom: 12,
        paint: {
          "fill-extrusion-color": [
            "interpolate",
            ["linear"],
            ["get", "height"],
            0, "#1a1a2e",
            50, "#16213e",
            100, "#0f3460",
            200, "#533483",
          ],
          "fill-extrusion-height": [
            "interpolate",
            ["linear"],
            ["zoom"],
            12, 0,
            12.05, ["get", "height"],
          ],
          "fill-extrusion-base": [
            "interpolate",
            ["linear"],
            ["zoom"],
            12, 0,
            12.05, ["get", "min_height"],
          ],
          "fill-extrusion-opacity": 0.7,
        },
      },
      labelLayerId
    );
  }

  function toggleMapStyle() {
    const ids = mapStyles.map((s) => s.id);
    const idx = ids.indexOf(mapStyle);
    const next = ids[(idx + 1) % ids.length];
    setMapStyle(next);
    if (mapRef.current) {
      const s = mapStyles.find((s) => s.id === next);
      if (s) {
        mapRef.current.setStyle(s.url);
        mapRef.current.once("style.load", () => {
          add3DBuildings(mapRef.current);
          updateRouteLines();
          addAllMarkers();
        });
      }
    }
  }

  useEffect(() => {
    activeTabRef.current = activeTab;
    addAllMarkers();
    const map = mapRef.current;
    if (map && map.getLayer) {
      const visible = activeTab !== "residents";
      ["officer-routes-glow", "officer-routes-line"].forEach((id) => {
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
      });
    }
  }, [activeTab]);

  useEffect(() => {
    focusedReportIdRef.current = focusedReportId;
    addAllMarkers();
  }, [focusedReportId]);

  function addAllMarkers() {
    const mapboxgl = mapboxglRef.current;
    if (!mapboxgl || !mapRef.current) return;

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

        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
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

        const marker = new mapboxgl.Marker({ element: el })
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

      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
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

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([off.longitude, off.latitude])
        .setPopup(popup)
        .addTo(mapRef.current);

      markersRef.current.push(marker);
    }

    if (showResidents) for (const r of residentsRef.current) {
      if (r.latitude == null || r.longitude == null) continue;
      if (focus && r.id !== focus) continue;

      const isRecent = Date.now() - new Date(r.created_at).getTime() < 24 * 60 * 60 * 1000;
      const crimeColor = getCrimeColor(r.crime_type);
      const initial = (r.crime_type || "?").charAt(0).toUpperCase();

      const el = document.createElement("div");
      el.className = `resident-marker${isRecent ? " active" : ""}`;
      el.style.background = `${crimeColor}22`;
      el.style.border = `2px solid ${crimeColor}`;
      el.style.color = crimeColor;
      el.style.fontWeight = "700";
      el.style.fontSize = "14px";
      el.textContent = initial;
      if (isRecent) {
        el.style.setProperty("--crime-pulse", `${crimeColor}66`);
      }

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([r.longitude, r.latitude])
        .addTo(mapRef.current);

      el.style.cursor = "pointer";
      el.addEventListener("click", () => {
        navigateRef.current(`/dashboard/reports/${r.id}`);
      });

      markersRef.current.push(marker);
    }

    // Police Post markers
    for (const post of policePostsRef.current) {
      if (post.latitude == null || post.longitude == null) continue;

      const el = document.createElement("div");
      el.className = "post-marker";
      el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px;"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;

      const officerHtml = post.officers?.length
        ? `<div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.08);font-size:11px;color:var(--gray-400);">
             <strong style="color:var(--gray-600)">Patrol Officers:</strong>
             ${post.officers.map((o) => `<div style="display:flex;align-items:center;gap:4px;margin-top:3px;color:var(--gray-500)">${o.full_name} <span style="color:var(--gray-400);font-size:10px">(${o.rank})</span></div>`).join("")}
           </div>`
        : "";

      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <div class="popup-content">
          <h4 style="display:flex;align-items:center;gap:6px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" style="width:16px;height:16px;"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            ${post.name}
          </h4>
          ${post.address ? `<p>${post.address}</p>` : ""}
          ${officerHtml}
        </div>
      `);

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([post.longitude, post.latitude])
        .setPopup(popup)
        .addTo(mapRef.current);

      el.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        openEditPost(post);
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
          <button className={`left-bar-btn${placingPost ? " active" : ""}`} onClick={() => setPlacingPost(!placingPost)} title="Add Police Post">
            <Shield size={16} />
          </button>
          <span className="left-bar-item-label">Add Post</span>
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
          <button className={`left-bar-btn${showRoutes ? " active" : ""}`} onClick={() => {
            const next = !showRoutes;
            setShowRoutes(next);
            const map = mapRef.current;
            if (map && map.getLayer) {
              ["officer-routes-glow", "officer-routes-line"].forEach((id) => {
                if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", next ? "visible" : "none");
              });
            }
          }} title="Toggle route lines">
            <Navigation size={16} />
          </button>
          <span className="left-bar-item-label">Routes</span>
        </div>
        <div className="left-bar-item">
          <button className="left-bar-btn" onClick={() => setShowSidebar(!showSidebar)} title="Toggle directory">
            {showSidebar ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
          </button>
          <span className="left-bar-item-label">Directory</span>
        </div>
      </div>

      <div className="tracking-clock">
        <div className="tracking-clock-time">
          {now.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}
        </div>
        <div className="tracking-clock-date">
          {now.toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
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
                          <div style={{
                            width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            background: `${getCrimeColor(r.crime_type)}22`,
                            border: `2px solid ${getCrimeColor(r.crime_type)}`,
                            color: getCrimeColor(r.crime_type),
                            fontWeight: 700, fontSize: 12,
                          }}>
                            {(r.crime_type || "?").charAt(0).toUpperCase()}
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

      {isPostModalOpen && (
        <div className="modal-overlay" onClick={resetPostModal}>
          <div className="rd-acct-modal" onClick={(e) => e.stopPropagation()} style={{ width: 360, maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
            <button className="rd-acct-modal-close" onClick={resetPostModal}>
              <X size={16} />
            </button>
            <div className="rd-acct-modal-header" style={{ marginBottom: 10 }}>
              <Shield size={12} /> {editingPostId ? "Edit Police Post" : "Add Police Post"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, overflow: "hidden" }}>
              <input
                type="text"
                className="pt-input"
                placeholder="Post name (e.g. Calbayog PNP Station 1)"
                value={postName}
                onChange={(e) => setPostName(e.target.value)}
                autoFocus
              />
              <div style={{ fontSize: 11, color: "var(--gray-500)" }}>
                {postPlaceLat != null && postPlaceLng != null
                  ? `📍 ${postPlaceLat.toFixed(4)}, ${postPlaceLng.toFixed(4)}`
                  : "Click on the map to set location"}
              </div>

              <div style={{ borderTop: "1px solid var(--gray-300)", paddingTop: 8 }}>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--gray-400)", marginBottom: 6 }}>
                  Patrol Officers
                </div>
                <input
                  type="text"
                  className="pt-input"
                  placeholder="Search officers..."
                  value={officerSearch}
                  onChange={(e) => setOfficerSearch(e.target.value)}
                  style={{ marginBottom: 6 }}
                />
                <div style={{ maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
                  {allOfficers
                    .filter((o) => !officerSearch || o.full_name?.toLowerCase().includes(officerSearch.toLowerCase()) || o.badge_id?.toLowerCase().includes(officerSearch.toLowerCase()))
                    .map((o) => {
                      const isSelected = selectedOfficers.has(o.id);
                      return (
                        <label
                          key={o.id}
                          className="rd-acct-modal-btn"
                          style={{
                            cursor: "pointer",
                            padding: "6px 10px",
                            fontSize: 11,
                            "--btn-clr": isSelected ? "#60a5fa" : "var(--gray-500)",
                            borderColor: isSelected ? "rgba(96,165,250,0.3)" : "var(--gray-300)",
                            background: isSelected ? "rgba(96,165,250,0.08)" : undefined,
                          } as React.CSSProperties}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              const next = new Set(selectedOfficers);
                              if (isSelected) next.delete(o.id); else next.add(o.id);
                              setSelectedOfficers(next);
                            }}
                            style={{ accentColor: "#60a5fa" }}
                          />
                          <span style={{ flex: 1 }}>{o.full_name}</span>
                          <span style={{ fontSize: 9, color: "var(--gray-400)" }}>{o.rank}</span>
                        </label>
                      );
                    })}
                  {allOfficers.length === 0 && (
                    <div style={{ fontSize: 11, color: "var(--gray-400)", padding: "8px 0", textAlign: "center" }}>No officers loaded</div>
                  )}
                </div>
                {selectedOfficers.size > 0 && (
                  <div style={{ fontSize: 10, color: "var(--gray-400)", marginTop: 4 }}>
                    {selectedOfficers.size} officer{selectedOfficers.size > 1 ? "s" : ""} selected
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "space-between", marginTop: "auto", paddingTop: 8, borderTop: "1px solid var(--gray-300)" }}>
                <div>
                  {editingPostId && (
                    <button className="btn btn-danger" onClick={deletePost}>Delete</button>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-outline" onClick={resetPostModal}>Cancel</button>
                  <button className="btn btn-primary" onClick={submitPost} disabled={!postName.trim()}>{editingPostId ? "Save" : "Add Post"}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
