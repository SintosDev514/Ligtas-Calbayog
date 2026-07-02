import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { Map, MapPin, Layers, AlertTriangle } from "lucide-react";

export default function CrimeHeatmap() {
  const navigate = useNavigate();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("admin-crime-heatmap")
      .on("postgres_changes", { event: "*", schema: "public", table: "crime_reports" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (reports.length > 0 && !mapRef.current) {
      initMap();
    }
  }, [reports]);

  const load = async () => {
    const { data } = await supabase
      .from("crime_reports")
      .select("id, crime_type, status, latitude, longitude, created_at")
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .limit(500);
    if (data) setReports(data);
    setLoading(false);
  };

  const initMap = async () => {
    try {
      const maplibre = await import("maplibre-gl");
      const map = new maplibre.Map({
        container: mapContainer.current!,
        style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
        center: [124.6, 12.07],
        zoom: 11,
      });
      mapRef.current = map;

      map.on("load", () => {
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

        const statusColors: Record<string, string> = {
          pending: "#f4b51a",
          "in-progress": "#2563eb",
          "resolved": "#10b981",
          "needs-backup": "#ef4444",
        };

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
          navigate(`/reports/${feature.properties.id}`);
        });
      });

      map.on("error", () => setMapError(true));
    } catch {
      setMapError(true);
    }
  };

  if (loading) return <div className="page-body"><div className="honeycomb"><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div></div>;

  const crimesWithLocation = reports.length;

  return (
    <>
      <div className="page-header">
        <h2><Map size={22} /> Crime Heatmap</h2>
        <span className="badge">{crimesWithLocation} points</span>
      </div>
      <div className="page-body">
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div ref={mapContainer} style={{ width: "100%", height: "calc(100vh - 200px)", minHeight: 500 }} />
          {mapError && (
            <div style={{ position: "absolute", top: 80, left: "50%", transform: "translateX(-50%)", background: "var(--red)", color: "#fff", padding: "10px 20px", borderRadius: 8, zIndex: 10 }}>
              <AlertTriangle size={16} /> Map tiles could not be loaded
            </div>
          )}
        </div>
      </div>
    </>
  );
}
