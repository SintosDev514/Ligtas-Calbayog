import { useEffect, useState, useRef } from "react";
import { supabase } from "../supabase";

interface OfficerWithLocation {
  officer_id: string;
  latitude: number;
  longitude: number;
  updated_at: string;
  officer: {
    id: string;
    full_name: string;
    badge_id: string;
    rank: string;
    station: string;
  } | null;
  report: {
    crime_type: string;
    status: string;
  } | null;
}

export default function PoliceTracking() {
  const [officers, setOfficers] = useState<OfficerWithLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    loadOfficers();
    const channel = supabase
      .channel("admin-tracking")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "police_locations" },
        () => loadOfficers()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      mapRef.current?.remove();
    };
  }, []);

  const loadOfficers = async () => {
    try {
      const { data: locations } = await supabase
        .from("police_locations")
        .select("*, report:crime_reports(crime_type, status)")
        .order("updated_at", { ascending: false });

      const officerIds = [...new Set((locations ?? []).map((l: any) => l.officer_id))];

      const { data: profiles } = await supabase
        .from("police_profiles")
        .select("*")
        .in("id", officerIds.length > 0 ? officerIds : ["none"]);

      const profileMap: Record<string, any> = {};
      for (const p of profiles ?? []) {
        profileMap[p.id] = p;
      }

      const latestPerOfficer: Record<string, any> = {};
      for (const loc of locations ?? []) {
        const oid = loc.officer_id;
        if (
          !latestPerOfficer[oid] ||
          new Date(loc.updated_at) > new Date(latestPerOfficer[oid].updated_at)
        ) {
          latestPerOfficer[oid] = loc;
        }
      }

      const result = Object.entries(latestPerOfficer).map(([oid, loc]) => ({
        ...loc,
        officer: profileMap[oid] || null,
      }));

      setOfficers(result);
      updateMapMarkers(result);
    } catch (err) {
      console.error("Failed to load officers:", err);
    } finally {
      setLoading(false);
    }
  };

  const updateMapMarkers = (officerData: OfficerWithLocation[]) => {
    if (!mapRef.current || !officerData.length) return;

    for (const m of markersRef.current) {
      m.remove();
    }
    markersRef.current = [];

    for (const off of officerData) {
      const isActive =
        Date.now() - new Date(off.updated_at).getTime() < 5 * 60 * 1000;

      const el = document.createElement("div");
      el.className = `officer-marker${isActive ? " active" : ""}`;
      el.textContent = off.officer?.full_name?.charAt(0) || "?";

      const popupContent = `
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
      `;

      import("maplibre-gl").then((maplibregl) => {
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([off.longitude, off.latitude])
          .setPopup(new maplibregl.Popup().setHTML(popupContent))
          .addTo(mapRef.current);

        markersRef.current.push(marker);
      });
    }
  };

  const initMap = () => {
    import("maplibre-gl").then((maplibregl) => {
      const container = document.getElementById("tracking-map");
      if (!container || mapRef.current) return;

      const map = new maplibregl.Map({
        container,
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: [124.6, 12.066],
        zoom: 12,
      });

      map.addControl(new maplibregl.NavigationControl(), "top-right");
      mapRef.current = map;

      map.on("load", () => {
        if (officers.length > 0) {
          updateMapMarkers(officers);
        }
      });
    });
  };

  useEffect(() => {
    initMap();
  }, []);

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
        <h2>Police Live Tracking</h2>
        <span style={{ fontSize: 13, color: "var(--gray-400)" }}>
          {officers.length} officer{officers.length !== 1 ? "s" : ""} online
        </span>
      </div>
      <div className="page-body">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20 }}>
          <div>
            <div
              id="tracking-map"
              className="map-container map-full"
            />
          </div>
          <div>
            <h3
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--gray-500)",
                marginBottom: 12,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Active Officers
            </h3>
            {officers.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {officers.map((off) => {
                  const isActive =
                    Date.now() - new Date(off.updated_at).getTime() < 5 * 60 * 1000;
                  return (
                    <div
                      key={off.officer_id}
                      className="card"
                      style={{ padding: 14 }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: "50%",
                            background: isActive ? "var(--green)" : "var(--gray-300)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "white",
                            fontWeight: 700,
                            fontSize: 14,
                          }}
                        >
                          {off.officer?.full_name?.charAt(0) || "?"}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>
                            {off.officer?.full_name || "Unknown"}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--gray-400)" }}>
                            {off.officer?.rank} · {off.officer?.station}
                          </div>
                          {off.report && (
                            <div
                              style={{
                                fontSize: 12,
                                color: "var(--gray-500)",
                                marginTop: 4,
                                textTransform: "capitalize",
                              }}
                            >
                              📋 {off.report.crime_type?.replace(/-/g, " ")}
                              <span className={`badge badge-${off.report.status}`} style={{ marginLeft: 6 }}>
                                {off.report.status}
                              </span>
                            </div>
                          )}
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--gray-400)",
                              marginTop: 4,
                            }}
                          >
                            Last update: {formatTime(off.updated_at)}
                          </div>
                        </div>
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            background: isActive ? "var(--green)" : "var(--gray-400)",
                            flexShrink: 0,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state" style={{ padding: 30 }}>
                <div className="icon">📍</div>
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
