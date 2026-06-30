import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import type { CrimeReport } from "../types";

const STATUSES = [
  "pending",
  "under-review",
  "in-progress",
  "resolved",
  "dismissed",
];

const NEEDS_BACKUP = "needs-backup";

export default function ReportDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState<any>(null);
  const [feedback, setFeedback] = useState<any>(null);
  const [actionUpdates, setActionUpdates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadReport();
    const channel = supabase
      .channel(`report-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "crime_reports", filter: `id=eq.${id}` },
        (payload) => setReport(payload.new)
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const loadReport = async () => {
    try {
      const { data: r } = await supabase
        .from("crime_reports")
        .select("*")
        .eq("id", id)
        .single();
      if (r) {
        const { data: rp } = await supabase
          .from("resident_profiles")
          .select("full_name, phone_number, address, avatar_url, id_photo_url")
          .eq("id", r.resident_id)
          .maybeSingle();
        r.resident = rp || null;
      }
      setReport(r);

      const { data: fb } = await supabase
        .from("report_feedback")
        .select("*")
        .eq("report_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setFeedback(fb);

      const { data: updates } = await supabase
        .from("action_updates")
        .select("*")
        .eq("report_id", id)
        .order("created_at", { ascending: true });
      setActionUpdates(updates ?? []);
    } catch (err) {
      console.error("Failed to load report:", err);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (status: string) => {
    setUpdating(true);
    try {
      await supabase
        .from("crime_reports")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (status === "in-progress" || status === NEEDS_BACKUP) {
        await supabase.from("action_updates").insert({
          report_id: id,
          action_type: status === NEEDS_BACKUP ? "backup_requested" : "dispatched",
          description:
            status === NEEDS_BACKUP
              ? "Backup has been requested for this incident"
              : "Police unit has been dispatched to the location",
          created_at: new Date().toISOString(),
        });
      }

      if (status === "resolved") {
        await supabase.from("action_updates").insert({
          report_id: id,
          action_type: "resolved",
          description: "Incident has been resolved",
          created_at: new Date().toISOString(),
        });
      }

      loadReport();
    } catch (err) {
      console.error("Failed to update status:", err);
    } finally {
      setUpdating(false);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
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

  if (!report) {
    return (
      <>
        <div className="page-header">
          <h2>Report Not Found</h2>
        </div>
        <div className="page-body">
          <div className="empty-state">
            <div className="icon">🔍</div>
            <h3>Report not found</h3>
            <button className="btn btn-outline" onClick={() => navigate("/reports")} style={{ marginTop: 16 }}>
              Back to Reports
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="btn btn-sm btn-outline" onClick={() => navigate("/reports")}>
            ← Back
          </button>
          <h2 style={{ textTransform: "capitalize" }}>
            {report.crime_type?.replace(/-/g, " ")}
          </h2>
          <span className={`badge badge-${report.status}`}>{report.status}</span>
        </div>
        <span style={{ fontSize: 13, color: "var(--gray-400)" }}>
          {formatDate(report.created_at)}
        </span>
      </div>
      <div className="page-body">
        <div className="report-detail-grid">
          <div>
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="report-info-section">
                <h3>Description</h3>
                <p>{report.description || "No description provided"}</p>
              </div>
              {report.photo_url && (
                <div className="report-info-section">
                  <h3>Evidence Photo</h3>
                  <img
                    src={report.photo_url}
                    alt="Report evidence"
                    style={{ maxWidth: "100%", maxHeight: 400, borderRadius: 8 }}
                  />
                </div>
              )}
              {report.location_address && (
                <div className="report-info-section">
                  <h3>Location</h3>
                  <p>{report.location_address}</p>
                  {report.latitude && report.longitude && (
                    <p style={{ fontSize: 13, color: "var(--gray-400)" }}>
                      {report.latitude.toFixed(6)}, {report.longitude.toFixed(6)}
                    </p>
                  )}
                </div>
              )}
              <div className="report-info-section">
                <h3>Share Live Location</h3>
                <p>{report.share_live_location ? "Yes" : "No"}</p>
              </div>
            </div>

            {feedback && (
              <div className="card" style={{ marginBottom: 20 }}>
                <div className="report-info-section">
                  <h3>Police Feedback</h3>
                  <p><strong>Officer:</strong> {feedback.officer_name || "N/A"}</p>
                  <p><strong>Response:</strong> {feedback.response_message || "N/A"}</p>
                  {feedback.estimated_arrival && (
                    <p><strong>ETA:</strong> {feedback.estimated_arrival}</p>
                  )}
                  <p style={{ fontSize: 12, color: "var(--gray-400)", marginTop: 8 }}>
                    {formatDate(feedback.created_at)}
                  </p>
                </div>
              </div>
            )}

            {actionUpdates.length > 0 && (
              <div className="card" style={{ marginBottom: 20 }}>
                <div className="report-info-section">
                  <h3>Action Timeline</h3>
                </div>
                {actionUpdates.map((u: any) => (
                  <div
                    key={u.id}
                    style={{
                      display: "flex",
                      gap: 12,
                      padding: "12px 0",
                      borderBottom: "1px solid var(--gray-100)",
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: "var(--gray-100)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 14,
                        flexShrink: 0,
                      }}
                    >
                      {u.action_type === "dispatched"
                        ? "🚓"
                        : u.action_type === "backup_requested"
                          ? "🆘"
                          : u.action_type === "resolved"
                            ? "✅"
                            : "📌"}
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 500, textTransform: "capitalize" }}>
                        {u.action_type?.replace(/_/g, " ")}
                      </p>
                      <p style={{ fontSize: 13, color: "var(--gray-500)" }}>
                        {u.description || ""}
                      </p>
                      <p style={{ fontSize: 11, color: "var(--gray-400)", marginTop: 2 }}>
                        {formatDate(u.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="report-info-section">
                <h3>Resident Info</h3>
                <p><strong>Name:</strong> {report.resident?.full_name || "Unknown"}</p>
                <p><strong>Phone:</strong> {report.resident?.phone_number || "—"}</p>
                <p><strong>Address:</strong> {report.resident?.address || "—"}</p>
              </div>
            </div>

            <div className="card" style={{ marginBottom: 20 }}>
              <div className="report-info-section">
                <h3>Status Actions</h3>
              </div>
              <div className="report-action-buttons">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    className={`btn btn-sm ${report.status === s ? "btn-primary" : "btn-outline"}`}
                    onClick={() => updateStatus(s)}
                    disabled={updating || report.status === s}
                    style={{ textTransform: "capitalize" }}
                  >
                    {s === "in-progress" ? "Accept" : s === "under-review" ? "Review" : s}
                  </button>
                ))}
              </div>
              {report.status !== NEEDS_BACKUP && report.status !== "resolved" && (
                <div style={{ marginTop: 12 }}>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => updateStatus(NEEDS_BACKUP)}
                    disabled={updating}
                  >
                    🆘 Request Backup
                  </button>
                </div>
              )}
              {report.status === NEEDS_BACKUP && (
                <div
                  style={{
                    marginTop: 12,
                    padding: "10px 14px",
                    background: "#FEF2F2",
                    borderRadius: 8,
                    color: "var(--red)",
                    fontSize: 13,
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  🆘 Backup has been requested for this incident
                </div>
              )}
            </div>

            {report.latitude && report.longitude && (
              <div className="card">
                <div className="report-info-section">
                  <h3>Location Map</h3>
                </div>
                <div
                  id="report-map"
                  style={{ width: "100%", height: 250, borderRadius: 8 }}
                >
                  <MapView
                    latitude={report.latitude}
                    longitude={report.longitude}
                    label={report.crime_type?.replace(/-/g, " ")}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function MapView({
  latitude,
  longitude,
  label,
}: {
  latitude: number;
  longitude: number;
  label?: string;
}) {
  useEffect(() => {
    let map: any = null;
    import("maplibre-gl").then((maplibregl) => {
      const container = document.getElementById("report-map");
      if (!container) return;
      map = new maplibregl.Map({
        container,
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: [longitude, latitude],
        zoom: 14,
      });
      map.addControl(new maplibregl.NavigationControl(), "top-right");
      new maplibregl.Marker({ color: "#DC2626" })
        .setLngLat([longitude, latitude])
        .setPopup(
          new maplibregl.Popup().setHTML(
            `<div class="popup-content"><h4>${label || "Location"}</h4></div>`
          )
        )
        .addTo(map);
    });
    return () => {
      map?.remove();
    };
  }, [latitude, longitude]);

  return null;
}
