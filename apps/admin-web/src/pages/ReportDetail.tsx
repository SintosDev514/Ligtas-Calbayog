import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { useAlarm } from "../context/AlarmContext";
import {
  ArrowLeft, AlertTriangle, MapPin, Clock, CheckCircle, XCircle,
  MessageSquare, Car, Shield, Eye, Phone, User,
  Image as ImageIcon, ExternalLink, Maximize2, X, Calendar, ImageOff,
  Video, Play, Ban, Send, PauseCircle, Crosshair, UserCog
} from "lucide-react";

const STATUSES = [
  "pending",
  "under-review",
  "in-progress",
  "resolved",
  "dismissed",
];

const NEEDS_BACKUP = "needs-backup";

const statusColors: Record<string, { bg: string; text: string; border: string }> = {
  pending: { bg: "rgba(245,158,11,0.12)", text: "#d97706", border: "rgba(245,158,11,0.25)" },
  "under-review": { bg: "rgba(37,107,235,0.12)", text: "#2563eb", border: "rgba(37,107,235,0.25)" },
  "in-progress": { bg: "rgba(139,92,246,0.12)", text: "#7c3aed", border: "rgba(139,92,246,0.25)" },
  resolved: { bg: "rgba(16,185,129,0.12)", text: "#059669", border: "rgba(16,185,129,0.25)" },
  dismissed: { bg: "rgba(100,116,139,0.12)", text: "#64748b", border: "rgba(100,116,139,0.25)" },
  "needs-backup": { bg: "rgba(239,68,68,0.12)", text: "#dc2626", border: "rgba(239,68,68,0.25)" },
};

const statusIcons: Record<string, typeof Clock> = {
  pending: Clock,
  "under-review": Eye,
  "in-progress": Car,
  resolved: CheckCircle,
  dismissed: XCircle,
};

const getTimelineIcon = (type: string) => {
  switch (type) {
    case "dispatched": return Car;
    case "backup_requested": return AlertTriangle;
    case "resolved": return CheckCircle;
    default: return Clock;
  }
};

const getTimelineColor = (type: string) => {
  switch (type) {
    case "dispatched": return "#7c3aed";
    case "backup_requested": return "#dc2626";
    case "resolved": return "#059669";
    default: return "#94a3b8";
  }
};

const BUCKET = "report-photos";
const SIGNED_URL_EXPIRY = 86400;

const getFilenameFromUrl = (url: string) => {
  try { return new URL(url).pathname.split("/").pop(); } catch { return null; }
};

export default function ReportDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState<any>(null);
  const [feedback, setFeedback] = useState<any>(null);
  const [actionUpdates, setActionUpdates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const { refreshAlarm } = useAlarm();
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxLoading, setLightboxLoading] = useState(false);
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());
  const [userStatus, setUserStatus] = useState<string>("approved");
  const [updatingUser, setUpdatingUser] = useState(false);
  const [assignedOfficer, setAssignedOfficer] = useState<any>(null);
  const [showAccountModal, setShowAccountModal] = useState(false);

  const getSignedUrl = useCallback(async (filename: string): Promise<string | null> => {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(filename, SIGNED_URL_EXPIRY);
    return data?.signedUrl ?? null;
  }, []);

  useEffect(() => {
    if (!id) return;
    loadReport();
    const channel = supabase
      .channel(`report-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "crime_reports", filter: `id=eq.${id}` },
        (payload) => {
          setReport(payload.new);
          const updated = payload.new as any;
          if (updated?.status === "in-progress" || updated?.assigned_officer_id) {
            setTimeout(loadAssignedOfficer, 1000);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "police_locations", filter: `report_id=eq.${id}` },
        () => loadAssignedOfficer()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "action_updates", filter: `report_id=eq.${id}` },
        (payload: any) => {
          setActionUpdates((prev: any[]) => [...prev, payload.new]);
          if (payload.new.action_type === "dispatched") loadAssignedOfficer();
        }
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
          .select("*")
          .eq("id", r.resident_id)
          .maybeSingle();
        r.resident = rp || null;
        const { data: u } = await supabase
          .from("users")
          .select("status")
          .eq("id", r.resident_id)
          .maybeSingle();
        setUserStatus(u?.status || "approved");
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
        .select("*, officer:police_profiles!officer_id(full_name, badge_id, rank, photo_url)")
        .eq("report_id", id)
        .order("created_at", { ascending: true });
      setActionUpdates(updates ?? []);

      await loadAssignedOfficer();
    } catch (err) {
      console.error("Failed to load report:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadAssignedOfficer = async () => {
    const { data: report } = await supabase
      .from("crime_reports")
      .select("assigned_officer_id")
      .eq("id", id)
      .single();
    let officer: any = null;

    if (report?.assigned_officer_id) {
      const { data: p } = await supabase
        .from("police_profiles")
        .select("id, full_name, badge_id, rank, photo_url")
        .eq("id", report.assigned_officer_id)
        .maybeSingle();
      officer = p || null;
    }

    if (!officer) {
      const { data: dispatched } = await supabase
        .from("action_updates")
        .select("*, officer:police_profiles!officer_id(id, full_name, badge_id, rank, photo_url)")
        .eq("report_id", id)
        .eq("action_type", "dispatched")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      officer = dispatched?.officer || null;
    }

    if (!officer) {
      const { data: loc } = await supabase
        .from("police_locations")
        .select("officer_id")
        .eq("report_id", id)
        .maybeSingle();
      if (loc?.officer_id) {
        const { data: p } = await supabase
          .from("police_profiles")
          .select("id, full_name, badge_id, rank, photo_url")
          .eq("id", loc.officer_id)
          .maybeSingle();
        officer = p || null;
      }
    }

    if (officer?.id) {
      const { data: assignment } = await supabase
        .from("police_post_assignments")
        .select("post_id")
        .eq("officer_id", officer.id)
        .maybeSingle();
      if (assignment?.post_id) {
        const { data: post } = await supabase
          .from("police_posts")
          .select("name")
          .eq("id", assignment.post_id)
          .maybeSingle();
        officer.assigned_post = post?.name || null;
      } else {
        officer.assigned_post = null;
      }
    }

    setAssignedOfficer(officer);
  };

  const updateUserStatus = async (status: string) => {
    setUpdatingUser(true);
    try {
      await supabase
        .from("users")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", report?.resident_id);
      setUserStatus(status);
    } catch (e) {
      console.error("Failed to update user status:", e);
    } finally {
      setUpdatingUser(false);
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

      if (report?.resident_id) {
        await supabase.from("notifications").insert({
          user_id: report.resident_id,
          type: "report_update",
          title: "Report Status Updated",
          body: `Your ${report.crime_type?.replace(/-/g, " ") || "report"} status has been changed to "${status.replace("-", " ")}".`,
          data: { report_id: id, status },
          created_at: new Date().toISOString(),
        });
      }

      loadReport();
      refreshAlarm();
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

  const formatDateShort = (d: string) =>
    new Date(d).toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const formatTime = (d: string) =>
    new Date(d).toLocaleTimeString("en-PH", {
      hour: "2-digit",
      minute: "2-digit",
    });

  const openStreetView = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`, "_blank");
  };

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

  if (!report) {
    return (
      <>
        <div className="page-header">
          <h2>Report Not Found</h2>
        </div>
      <div className="page-body rd-page-body">
          <div className="empty-state">
            <div className="empty-icon"><AlertTriangle size={24} /></div>
            <h3>Report not found</h3>
            <button className="btn btn-outline" onClick={() => navigate("/reports")} style={{ marginTop: 16 }}>
              Back to Reports
            </button>
          </div>
        </div>
      </>
    );
  }

  const photoUrls: string[] = report.photo_url
    ? report.photo_url.split(",").map((u: string) => u.trim()).filter(Boolean)
    : [];

  const isVideoUrl = (url: string) => /\.(mp4|webm|mov|avi)$/i.test(url);

  const StatusIcon = statusIcons[report.status] || Clock;
  const sc = statusColors[report.status] || statusColors.dismissed;

  return (
    <>
      <div className="page-header">
        <div className="rd-header-left">
          <button className="btn btn-sm btn-outline" onClick={() => navigate("/reports")}>
            <ArrowLeft size={15} /> Back
          </button>
          <h2 className="rd-title">{report.crime_type?.replace(/-/g, " ")}</h2>
          <span className={`rd-badge rd-badge-${report.status}`}>
            <StatusIcon size={12} />
            {report.status?.replace("-", " ")}
          </span>
        </div>
        <span className="rd-header-date">{formatDate(report.created_at)}</span>
      </div>

      <div className="page-body rd-page-body">
        <div className="rd-layout">
          <div className="rd-main">
            <div className="rd-main-row">
              <div className="rd-card rd-card-desc" style={{ "--rd-accent": "#0ea5e9" } as React.CSSProperties}>
                <div className="rd-card-head">
                  <MessageSquare size={13} />
                  <span>Description</span>
                </div>
                <p className="rd-description">
                  {report.description || "No description provided."}
                </p>
              </div>

              {photoUrls.length > 0 && (
                <div className="rd-card rd-card-media" style={{ "--rd-accent": "#6366f1" } as React.CSSProperties}>
                  <div className="rd-card-head">
                    <ImageIcon size={13} />
                    <span>Evidence Photos</span>
                    <span className="rd-card-badge">{photoUrls.length}</span>
                  </div>
                  <div className={`rd-photo-grid ${photoUrls.length === 1 ? "single" : ""}`}>
                    {photoUrls.slice(0, 4).map((url, i) => {
                      const isVideo = isVideoUrl(url);
                      return (
                      <div
                        key={i}
                        className="rd-photo-item"
                        onClick={async () => {
                          if (failedImages.has(i)) return;
                          if (isVideo) { setLightboxUrl(url); return; }
                          setLightboxLoading(true);
                          const name = getFilenameFromUrl(url);
                          if (name) {
                            const signed = await getSignedUrl(name);
                            if (signed) { setLightboxUrl(signed); setLightboxLoading(false); return; }
                          }
                          setLightboxUrl(url);
                          setLightboxLoading(false);
                        }}
                      >
                        {failedImages.has(i) ? (
                          <div className="rd-photo-failed" title={url}>
                            <ImageOff size={18} />
                          </div>
                        ) : isVideo ? (
                          <>
                            <video src={url} muted playsInline preload="metadata"
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                              onError={() => setFailedImages((prev) => new Set(prev).add(i))} />
                            <div className="rd-photo-zoom"><Play size={13} /></div>
                          </>
                        ) : (
                          <>
                            <img
                              src={url}
                              alt={`Evidence ${i + 1}`}
                              onError={() => setFailedImages((prev) => new Set(prev).add(i))}
                            />
                            <div className="rd-photo-zoom"><Maximize2 size={13} /></div>
                          </>
                        )}
                        {i === 3 && photoUrls.length > 4 && (
                          <div className="rd-photo-overlay">+{photoUrls.length - 4}</div>
                        )}
                      </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="rd-card rd-card-location" style={{ "--rd-accent": "#f59e0b" } as React.CSSProperties}>
              <div className="rd-card-head">
                <MapPin size={13} />
                <span>Location Details</span>
              </div>
              <div className="rd-location-info">
                {report.location_address && (
                  <div className="rd-loc-row rd-loc-address">
                    <span className="rd-loc-label">Address</span>
                    <span className="rd-loc-value rd-loc-address-value">{report.location_address}</span>
                  </div>
                )}
                {report.latitude != null && report.longitude != null && (
                  <div className="rd-loc-row">
                    <span className="rd-loc-label">Coordinates</span>
                    <span className="rd-loc-coords">
                      <Crosshair size={10} />
                      {Number(report.latitude).toFixed(4)}, {Number(report.longitude).toFixed(4)}
                    </span>
                  </div>
                )}
                {report.latitude != null && report.longitude != null && (
                  <div className="rd-loc-actions">
                    <button className="rd-loc-btn rd-loc-btn-street" onClick={() => openStreetView(report.latitude!, report.longitude!)}>
                      <Eye size={12} />
                      <span>Street View</span>
                    </button>
                  </div>
                )}
                <div className="rd-loc-row rd-loc-live-row">
                  <span className="rd-loc-label">Live Location</span>
                  <span className={`rd-loc-tag ${report.share_live_location ? "on" : ""}`}>
                    {report.share_live_location ? "Enabled" : "Disabled"}
                  </span>
                </div>
              </div>
              {report.latitude != null && report.longitude != null && (
                <div className="rd-map-box">
                  <MapView
                    latitude={report.latitude}
                    longitude={report.longitude}
                    label={report.crime_type?.replace(/-/g, " ")}
                  />
                </div>
              )}
            </div>

            {actionUpdates.length > 0 && (
              <div className="rd-card rd-card-timeline" style={{ "--rd-accent": "#8b5cf6" } as React.CSSProperties}>
                <div className="rd-card-head">
                  <Clock size={13} />
                  <span>Action Timeline</span>
                  <span className="rd-card-badge">{actionUpdates.length}</span>
                </div>
                <div className="rd-timeline">
                  {actionUpdates.map((u: any, i: number) => {
                    const Icon = getTimelineIcon(u.action_type);
                    const color = getTimelineColor(u.action_type);
                    const isLast = i === actionUpdates.length - 1;
                    return (
                      <div key={u.id} className="rd-tl-item">
                        <div className="rd-tl-track">
                          <div className="rd-tl-dot" style={{ borderColor: color }} />
                          {!isLast && <div className="rd-tl-line" style={{ background: color }} />}
                        </div>
                        <div className="rd-tl-body">
                          <div className="rd-tl-top">
                            <span className="rd-tl-action">{u.action_type?.replace(/_/g, " ")}</span>
                            <span className="rd-tl-time">
                              {formatDateShort(u.created_at)} at {formatTime(u.created_at)}
                            </span>
                          </div>
                          {u.description && <p className="rd-tl-desc">{u.description}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="rd-side">
            <div className="rd-card rd-card-combo" style={{ "--rd-accent": "#14b8a6" } as React.CSSProperties}>

              {/* Resident Info */}
              <div className="rd-combo-section">
                <div className="rd-resident">
                  <div className="rd-res-avatar">
                    {report.resident?.avatar_url || report.resident?.id_photo_url ? (
                      <img src={report.resident.avatar_url || report.resident.id_photo_url} alt="" />
                    ) : (
                      <User size={18} />
                    )}
                  </div>
                  <div className="rd-res-body">
                    <div className="rd-res-name">{report.resident?.full_name || "Unknown"}</div>
                    <div className="rd-res-row"><Phone size={10} /> {report.resident?.phone_number || "—"}</div>
                    <div className="rd-res-row"><MapPin size={10} /> {report.resident?.address || "—"}</div>
                    <div className="rd-res-row"><Phone size={10} /> EC: {report.resident?.emergency_contact || "—"}</div>
                    {report.resident?.latitude != null && (
                      <div className="rd-res-row"><MapPin size={10} /> {Number(report.resident.latitude).toFixed(4)}, {Number(report.resident.longitude).toFixed(4)}</div>
                    )}
                  </div>
                </div>
                <div className="rd-res-detail cc" style={{ marginTop: 6 }}>
                  <span className="rd-res-label">Cancel Count</span>
                  <span className="rd-res-value">{report.resident?.cancel_count ?? 0}</span>
                </div>
                {(report.resident?.guardian_name || report.resident?.father_name || report.resident?.mother_name) && (
                  <div className="rd-divider" />
                )}
                {report.resident?.guardian_name && (
                  <div className="rd-res-detail">
                    <span className="rd-res-label">Guardian</span>
                    <span className="rd-res-value">{report.resident.guardian_name}{report.resident.guardian_phone ? ` (${report.resident.guardian_phone})` : ""}</span>
                  </div>
                )}
                {report.resident?.father_name && (
                  <div className="rd-res-detail">
                    <span className="rd-res-label">Father</span>
                    <span className="rd-res-value">{report.resident.father_name}{report.resident.father_phone ? ` (${report.resident.father_phone})` : ""}</span>
                  </div>
                )}
                {report.resident?.mother_name && (
                  <div className="rd-res-detail">
                    <span className="rd-res-label">Mother</span>
                    <span className="rd-res-value">{report.resident.mother_name}{report.resident.mother_phone ? ` (${report.resident.mother_phone})` : ""}</span>
                  </div>
                )}
              </div>

              <div className="rd-divider" />

              {/* Account Status */}
              <div className="rd-combo-section">
                <div className="rd-combo-row">
                  <span className="rd-combo-label">Account</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div className={`rd-status-badge rd-status-${userStatus}`}>
                      <Shield size={10} />
                      {userStatus}
                    </div>
                    <button className="rd-acct-icon-btn" onClick={() => setShowAccountModal(true)}>
                      <UserCog size={14} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="rd-divider" />

              {/* Status */}
              <div className="rd-combo-section">
                <div className="rd-combo-row" style={{ marginBottom: 6 }}>
                  <span className="rd-combo-label">Report Status</span>
                </div>
                <div className="rd-status-hero" style={{ background: sc.bg, borderColor: sc.border }}>
                  <StatusIcon size={16} />
                  <span>{report.status?.replace("-", " ")}</span>
                </div>
                <div className="rd-status-meta">
                  <Calendar size={11} />
                  Reported {formatDateShort(report.created_at)}
                </div>
                <div className="rd-actions-grid" style={{ marginTop: 7 }}>
                  {STATUSES.map((s) => {
                    const Icon = statusIcons[s] || Clock;
                    const isActive = report.status === s;
                    const sColors = statusColors[s] || statusColors.dismissed;
                    return (
                      <button
                        key={s}
                        className={`rd-action-btn ${isActive ? "active" : ""}`}
                        style={{
                          "--act-bg": sColors.bg,
                          "--act-clr": sColors.text,
                          "--act-bdr": sColors.border,
                        } as React.CSSProperties}
                        onClick={() => updateStatus(s)}
                        disabled={updating || isActive}
                      >
                        <Icon size={11} />
                        {s === "in-progress" ? "Accept" : s === "under-review" ? "Review" : s}
                      </button>
                    );
                  })}
                </div>
                {report.status !== NEEDS_BACKUP && report.status !== "resolved" && (
                  <button className="rd-danger-btn" onClick={() => updateStatus(NEEDS_BACKUP)} disabled={updating}>
                    <AlertTriangle size={11} />
                    Request Backup
                  </button>
                )}
                {report.status === NEEDS_BACKUP && (
                  <div className="rd-danger-alert">
                    <AlertTriangle size={13} />
                    Backup requested for this incident
                  </div>
                )}
              </div>

              <div className="rd-divider" />

              {/* Assigned Officer */}
              <div className="rd-combo-section">
                {assignedOfficer ? (
                  <div className="rd-officer-info" style={{ padding: 0 }}>
                    <div className="rd-officer-avatar">
                      {assignedOfficer.photo_url ? (
                        <img src={assignedOfficer.photo_url} alt="" />
                      ) : (
                        <Shield size={18} />
                      )}
                    </div>
                    <div className="rd-officer-body">
                      <div className="rd-officer-name">{assignedOfficer.full_name}</div>
                      <div className="rd-officer-row"><Shield size={10} /> {assignedOfficer.badge_id || "—"}</div>
                      <div className="rd-officer-row"><Shield size={10} /> {assignedOfficer.rank || "—"}</div>
                      {assignedOfficer.assigned_post ? (
                        <div className="rd-officer-row" style={{ color: "var(--gray-400)" }}><MapPin size={10} /> {assignedOfficer.assigned_post}</div>
                      ) : (
                        <div className="rd-officer-row" style={{ color: "var(--gray-500)", fontStyle: "italic" }}>No assigned post</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rd-officer-empty" style={{ padding: "4px 0" }}>
                    <Shield size={22} />
                    <span>No officer assigned yet</span>
                  </div>
                )}
              </div>

            </div>

            {feedback && (
              <div className="rd-card rd-card-feedback" style={{ "--rd-accent": "#ec4899" } as React.CSSProperties}>
                <div className="rd-card-head">
                  <MessageSquare size={13} />
                  <span>Police Feedback</span>
                </div>
                <div className="rd-feedback">
                  <div className="rd-fb-row">
                    <span className="rd-fb-label">Officer</span>
                    <span className="rd-fb-value">{feedback.officer_name || "N/A"}</span>
                  </div>
                  <div className="rd-fb-row">
                    <span className="rd-fb-label">Response</span>
                    <span className="rd-fb-value">{feedback.response_message || "N/A"}</span>
                  </div>
                  {feedback.estimated_arrival && (
                    <div className="rd-fb-row">
                      <span className="rd-fb-label">ETA</span>
                      <span className="rd-fb-value">{feedback.estimated_arrival}</span>
                    </div>
                  )}
                  <div className="rd-fb-date">{formatDate(feedback.created_at)}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showAccountModal && (
        <div className="modal-overlay" onClick={() => setShowAccountModal(false)}>
          <div className="rd-acct-modal" onClick={(e) => e.stopPropagation()}>
            <button className="rd-acct-modal-close" onClick={() => setShowAccountModal(false)}>
              <X size={16} />
            </button>
            <div className="rd-acct-modal-header">
              <UserCog size={18} />
              <span>Account Actions</span>
            </div>
            <div className="rd-acct-modal-name">{report?.resident?.full_name || "Unknown"}</div>
            <div className="rd-acct-modal-actions">
              {userStatus !== "approved" && (
                <button
                  className="rd-acct-modal-btn"
                  style={{ "--btn-clr": "#10b981" } as React.CSSProperties}
                  onClick={() => { updateUserStatus("approved"); setShowAccountModal(false); }}
                  disabled={updatingUser}
                >
                  <CheckCircle size={16} /> Approve
                </button>
              )}
              <button
                className="rd-acct-modal-btn"
                style={{ "--btn-clr": "#f59e0b" } as React.CSSProperties}
                onClick={() => { updateUserStatus("suspended"); setShowAccountModal(false); }}
                disabled={updatingUser || userStatus === "suspended"}
              >
                <PauseCircle size={16} /> Suspend
              </button>
              <button
                className="rd-acct-modal-btn"
                style={{ "--btn-clr": "#ef4444" } as React.CSSProperties}
                onClick={() => { updateUserStatus("banned"); setShowAccountModal(false); }}
                disabled={updatingUser || userStatus === "banned"}
              >
                <Ban size={16} /> Ban
              </button>
              <button
                className="rd-acct-modal-btn"
                style={{ "--btn-clr": "#6366f1" } as React.CSSProperties}
                onClick={() => { window.location.href = `tel:${report?.resident?.phone_number || ""}`; setShowAccountModal(false); }}
              >
                <Send size={16} /> Message
              </button>
            </div>
          </div>
        </div>
      )}

      {(lightboxUrl || lightboxLoading) && (
        <div className="rd-lightbox" onClick={() => { setLightboxUrl(null); setLightboxLoading(false); }}>
          <button className="rd-lb-close" onClick={() => { setLightboxUrl(null); setLightboxLoading(false); }}>
            <X size={22} />
          </button>
          {lightboxLoading ? (
            <div style={{
              color: "#fff", fontSize: 14, display: "flex", flexDirection: "column",
              alignItems: "center", gap: 10,
            }}>
              Loading...
            </div>
          ) : lightboxUrl && isVideoUrl(lightboxUrl) ? (
            <video className="rd-lb-img" src={lightboxUrl} controls autoPlay
              onClick={(e) => e.stopPropagation()} />
          ) : lightboxUrl ? (
            <img className="rd-lb-img" src={lightboxUrl} alt="" onClick={(e) => e.stopPropagation()} />
          ) : null}
        </div>
      )}
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
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: any = null;
    import("maplibre-gl").then(async (maplibregl) => {
      if (!containerRef.current) return;
      map = new maplibregl.Map({
        container: containerRef.current,
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: [longitude, latitude],
        zoom: 14,
      });
      new maplibregl.Marker({ color: "#DC2626" })
        .setLngLat([longitude, latitude])
        .setPopup(
          new maplibregl.Popup().setHTML(
            `<div class="popup-content"><h4>${label || "Location"}</h4></div>`
          )
        )
        .addTo(map);

      const { data: posts } = await supabase
        .from("police_posts")
        .select("id, name, latitude, longitude, address")
        .order("name");
      if (posts) {
        for (const post of posts) {
          if (post.latitude == null || post.longitude == null) continue;
          const el = document.createElement("div");
          el.className = "post-marker";
          el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px;"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;
          new maplibregl.Marker({ element: el })
            .setLngLat([post.longitude, post.latitude])
            .setPopup(
              new maplibregl.Popup({ offset: 25 }).setHTML(
                `<div class="popup-content"><h4 style="display:flex;align-items:center;gap:6px;"><svg viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" style="width:16px;height:16px;"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg> ${post.name}</h4>${post.address ? `<p>${post.address}</p>` : ""}</div>`
              )
            )
            .addTo(map);
        }
      }
    });
    return () => {
      map?.remove();
    };
  }, [latitude, longitude]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
