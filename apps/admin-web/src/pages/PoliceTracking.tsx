import { useEffect, useState, useRef } from "react";
import { supabase } from "../supabase";
import { MapPin, Clock, Shield, Navigation } from "lucide-react";

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

export default function PoliceTracking() {
  const [officers, setOfficers] = useState<OfficerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapError, setMapError] = useState(false);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const maplibreglRef = useRef<any>(null);

  useEffect(() => {
    let active = true;
    loadOfficers().then(() => {
      if (active) initMap();
    });

    const channel = supabase
      .channel("admin-tracking")
      .on("postgres_changes", { event: "*", schema: "public", table: "police_locations" }, () => {
        loadOfficers().then(() => {
          if (mapRef.current) addMarkers();
        });
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markersRef.current = [];
    };
  }, []);

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

      const result: OfficerData[] = Object.entries(latestPerOfficer).map(([oid, loc]) => ({
        ...loc,
        officer: profileMap[oid] || null,
      }));

      setOfficers(result);
    } catch (err) {
      console.error("Failed to load officers:", err);
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

      const map = new maplibregl.Map({
        container,
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: [124.6, 12.066],
        zoom: 12,
      });

      map.addControl(new maplibregl.NavigationControl(), "top-right");
      mapRef.current = map;

      map.on("load", () => addMarkers());
      map.on("error", () => setMapError(true));
    } catch {
      setMapError(true);
    }
  }

  function addMarkers() {
    const maplibregl = maplibreglRef.current;
    if (!maplibregl || !mapRef.current) return;

    for (const m of markersRef.current) m.remove();
    markersRef.current = [];

    const data = officers;
    if (!data.length) return;

    for (const off of data) {
      if (off.latitude == null || off.longitude == null) continue;

      const isActive =
        Date.now() - new Date(off.updated_at).getTime() < 5 * 60 * 1000;

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
          <h4>${off.officer?.full_name || "Unknown Officer"}</h4>
          <p>Badge: ${off.officer?.badge_id || "—"}</p>
          <p>Rank: ${off.officer?.rank || "—"}</p>
          <p>Station: ${off.officer?.station || "—"}</p>
          ${off.report ? `<p>Responding to: ${off.report.crime_type?.replace(/-/g, " ")} (${off.report.status})</p>` : ""}
          <p style="color: var(--gray-400); font-size: 11px; margin-top: 4px;">
            Updated: ${new Date(off.updated_at).toLocaleTimeString()}
          </p>
          ${isActive ? '<p style="color: #059669; font-weight: 600;">● Active</p>' : '<p style="color: #D97706;">○ Away</p>'}
        </div>
      `);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([off.longitude, off.latitude])
        .setPopup(popup)
        .addTo(mapRef.current);

      markersRef.current.push(marker);
    }
  }

  const formatTime = (d: string) =>
    new Date(d).toLocaleTimeString("en-PH", {
      hour: "2-digit",
      minute: "2-digit",
    });

  if (loading) {
    return (
      <div className="page-body" style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h2>
          <Navigation size={20} style={{ marginRight: 8, verticalAlign: "middle" }} />
          Police Live Tracking
        </h2>
        <span style={{ fontSize: 13, color: "var(--gray-400)", display: "flex", alignItems: "center", gap: 6 }}>
          <Shield size={14} />
          {officers.length} officer{officers.length !== 1 ? "s" : ""} online
        </span>
      </div>
      <div className="page-body" style={{ position: "relative" }}>
        <div className="tracking-grid">
          <div style={{ position: "relative" }}>
            <div
              id="tracking-map"
              className="map-container map-full"
            />
            {mapError && (
              <div style={{
                position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", background: "var(--gray-50)",
                color: "var(--gray-400)", borderRadius: "var(--radius-lg)", gap: 12, zIndex: 1
              }}>
                <MapPin size={32} />
                <p>Map failed to load — check your internet connection</p>
              </div>
            )}
          </div>
          <div className="tracking-sidebar">
            <h3>
              <Shield size={14} style={{ marginRight: 6, verticalAlign: "middle" }} />
              Active Officers
            </h3>
            {officers.length > 0 ? (
              <div className="tracking-sidebar-list">
                {officers.map((off) => {
                  const isActive =
                    Date.now() - new Date(off.updated_at).getTime() < 5 * 60 * 1000;
                  return (
                    <div
                      key={off.officer_id}
                      className="card officer-card"
                    >
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
                          {off.report && (
                            <div
                              style={{
                                fontSize: 12,
                                color: "var(--gray-500)",
                                marginTop: 4,
                                textTransform: "capitalize",
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <MapPin size={12} />
                              {off.report.crime_type?.replace(/-/g, " ")}
                              <span className={`badge badge-${off.report.status}`} style={{ marginLeft: 4 }}>
                                {off.report.status}
                              </span>
                            </div>
                          )}
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--gray-400)",
                              marginTop: 4,
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
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
              <div className="empty-state" style={{ padding: 30 }}>
                <div className="empty-icon"><MapPin size={24} /></div>
                <h3>No Officers Online</h3>
                <p>No police location data available</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
