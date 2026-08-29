import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { useAlarm } from "../context/AlarmContext";
import {
  ArrowLeft, AlertTriangle, MapPin, Clock, CheckCircle, XCircle,
  MessageSquare, Car, Shield, Eye, Phone, User,
  Image as ImageIcon, ExternalLink, Maximize2, X, Calendar, ImageOff,
  Video, Play, Ban, Send, PauseCircle, Crosshair, UserCog,
  Volume2, VolumeX, Navigation, Compass
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
    case "accepted": return Shield;
    case "dispatched": return Car;
    case "backup_requested": return AlertTriangle;
    case "resolved": return CheckCircle;
    default: return Clock;
  }
};

const getTimelineColor = (type: string) => {
  switch (type) {
    case "accepted": return "#3b82f6";
    case "dispatched": return "#7c3aed";
    case "backup_requested": return "#dc2626";
    case "resolved": return "#059669";
    default: return "#94a3b8";
  }
};

const RESPONSE_DETAIL_TYPES = [
  "arrived",
  "investigating",
  "dispatch_sent",
  "suspect_detained",
  "other",
  "notes",
  "backup_requested",
];

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
  const { refreshAlarm, playBackupAlert } = useAlarm();
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxLoading, setLightboxLoading] = useState(false);
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());
  const [userStatus, setUserStatus] = useState<string>("approved");
  const [updatingUser, setUpdatingUser] = useState(false);
  const [assignedOfficer, setAssignedOfficer] = useState<any>(null);
  const [acceptedAt, setAcceptedAt] = useState<string | null>(null);
  const [officerLoc, setOfficerLoc] = useState<{ latitude: number; longitude: number; heading?: number | null } | null>(null);
  const [routeData, setRouteData] = useState<any>(null);
  const [routeDistance, setRouteDistance] = useState<string | null>(null);
  const [routeDuration, setRouteDuration] = useState<string | null>(null);
  const [relatedReports, setRelatedReports] = useState<any[]>([]);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const spokenIdRef = useRef<string | null>(null);

  const speakDescription = useCallback((text: string) => {
    if (!("speechSynthesis" in window) || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.85;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }, []);

  const stopSpeaking = useCallback(() => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    if (!report?.description || spokenIdRef.current === report.id) return;
    if (localStorage.getItem("admin-tts-enabled") === "off") return;
    spokenIdRef.current = report.id;
    speakDescription(report.description);
  }, [report, speakDescription]);

  const getSignedUrl = useCallback(async (filename: string): Promise<string | null> => {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(filename, SIGNED_URL_EXPIRY);
    return data?.signedUrl ?? null;
  }, []);

  useEffect(() => {
    if (!id) return;
    loadReport();
    fetchOfficerLocation();
    const channel = supabase
      .channel(`report-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "crime_reports", filter: `id=eq.${id}` },
        async (payload) => {
          setReport(payload.new);
          loadAssignedOfficer();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "police_locations", filter: `report_id=eq.${id}` },
        (payload: any) => {
          const n = payload.new;
          if (n?.latitude != null && n?.longitude != null) {
            setOfficerLoc({ latitude: n.latitude, longitude: n.longitude, heading: n.heading });
          }
          loadAssignedOfficer();
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "action_updates", filter: `report_id=eq.${id}` },
        (payload: any) => {
          setActionUpdates((prev: any[]) => [...prev, payload.new]);
          loadAssignedOfficer();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const interval = setInterval(() => {
      loadAssignedOfficer();
      fetchOfficerLocation();
    }, 5000);
    return () => clearInterval(interval);
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
      if (r?.crime_type) loadRelatedReports(r.crime_type, r.id);

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

  const loadRelatedReports = async (crimeType: string, reportId: string) => {
    try {
      const { data } = await supabase
        .from("crime_reports")
        .select("id, crime_type, location_address, latitude, longitude, status, created_at")
        .eq("crime_type", crimeType)
        .neq("id", reportId)
        .order("created_at", { ascending: false })
        .limit(6);
      setRelatedReports(data ?? []);
    } catch (e) {
      console.warn("Failed to load related reports:", e);
    }
  };

  const loadAssignedOfficer = async () => {
    try {
      const { data: report } = await supabase
        .from("crime_reports")
        .select("assigned_officer_id")
        .eq("id", id)
        .single();
      let officer: any = null;
      let accepted: any = null;

      if (report?.assigned_officer_id) {
        const { data: p } = await supabase
          .from("police_profiles")
          .select("id, full_name, badge_id, rank, photo_url")
          .eq("id", report.assigned_officer_id)
          .maybeSingle();
        officer = p || null;
      }

      if (!officer) {
        const { data: acc } = await supabase
          .from("action_updates")
          .select("*, officer:police_profiles!officer_id(id, full_name, badge_id, rank, photo_url)")
          .eq("report_id", id)
          .eq("action_type", "accepted")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        accepted = acc;
        officer = acc?.officer || null;
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

      if (!accepted && officer?.id) {
        const { data: acc } = await supabase
          .from("action_updates")
          .select("created_at")
          .eq("report_id", id)
          .eq("action_type", "accepted")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        accepted = acc;
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
      setAcceptedAt(accepted?.created_at || null);
    } catch (e) {
      console.error("loadAssignedOfficer failed:", e);
    }
  };

  const fetchOfficerLocation = useCallback(async () => {
    if (!id) return;
    const query = supabase
      .from("police_locations")
      .select("latitude, longitude, heading")
      .eq("report_id", id);
    let data: any = null;
    try {
      const res = await query.maybeSingle();
      data = res.data;
      if (res.error && (res.error as any)?.message?.includes("heading")) {
        // heading column not deployed yet; retry without it
        const fallback = await supabase
          .from("police_locations")
          .select("latitude, longitude")
          .eq("report_id", id)
          .maybeSingle();
        data = fallback.data;
      }
    } catch (e) {
      console.warn("fetchOfficerLocation failed:", e);
    }
    if (data?.latitude != null && data?.longitude != null) {
      setOfficerLoc({ latitude: data.latitude, longitude: data.longitude, heading: data.heading });
    }
  }, [id]);

  const fetchRoute = useCallback(async (from: { latitude: number; longitude: number }) => {
    if (!report) return;
    if (report.latitude == null || report.longitude == null) return;
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${from.longitude},${from.latitude};${report.longitude},${report.latitude}?geometries=geojson&overview=full`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.code === "Ok" && json.routes?.length) {
        const route = json.routes[0];
        setRouteData({ geometry: route.geometry });
        setRouteDistance(`${(route.distance / 1000).toFixed(1)} km`);
        setRouteDuration(`${Math.round(route.duration / 60)} min`);
      }
    } catch (e) {
      console.warn("Route fetch failed:", e);
    }
  }, [report]);

  useEffect(() => {
    if (!officerLoc) return;
    fetchRoute(officerLoc);
  }, [officerLoc, fetchRoute]);

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
          officer_id: report?.assigned_officer_id || null,
          description:
            status === NEEDS_BACKUP
              ? "Backup has been requested for this incident"
              : "Police unit has been dispatched to the location",
          created_at: new Date().toISOString(),
        });
      }

      if (status === NEEDS_BACKUP) {
        playBackupAlert();
      }

      if (status === "resolved") {
        await supabase.from("action_updates").insert({
          report_id: id,
          action_type: "resolved",
          officer_id: report?.assigned_officer_id || null,
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
            <button className="btn btn-outline" onClick={() => navigate("/dashboard/reports")} style={{ marginTop: 16 }}>
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
          <button className="btn btn-sm btn-outline" onClick={() => navigate("/dashboard/reports")}>
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
                  {report.description && (
                    <button
                      className={`rd-tts-btn${isSpeaking ? " speaking" : ""}`}
                      onClick={() => (isSpeaking ? stopSpeaking() : speakDescription(report.description))}
                      title={isSpeaking ? "Stop voice over" : "Play voice over"}
                    >
                      {isSpeaking ? <VolumeX size={13} /> : <Volume2 size={13} />}
                    </button>
                  )}
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

            <div className="rd-main-row" style={{ display: "flex", gap: 16, minHeight: 420 }}>
              <div className="rd-card rd-card-location" style={{ flex: 1, minWidth: 0, "--rd-accent": "#f59e0b" } as React.CSSProperties}>
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
                  <>
                    <div className="rd-route-head">
                      <span className="rd-route-head-title">Route Overview</span>
                      {officerLoc && (
                        <span className="rd-route-head-live">
                          <span className="rd-route-live-dot" />
                          Live
                        </span>
                      )}
                    </div>
                    <div className="rd-map-box">
                      <MapView
                        reportId={id!}
                        latitude={report.latitude}
                        longitude={report.longitude}
                        label={`Incident: ${report.crime_type?.replace(/-/g, " ")}`}
                        residentLatitude={report.resident?.latitude}
                        residentLongitude={report.resident?.longitude}
                        residentLabel={report.resident?.full_name || "Resident"}
                        officerLoc={officerLoc}
                        routeData={routeData}
                      />
                    </div>
                    <div className="rd-route-stats">
                      <div className="rd-route-stat">
                        <div className="rd-route-stat-icon rd-route-stat-icon-blue">
                          <Navigation size={16} />
                        </div>
                        <div className="rd-route-stat-value">{routeDistance || "—"}</div>
                        <div className="rd-route-stat-label">Distance</div>
                      </div>
                      <div className="rd-route-stat">
                        <div className="rd-route-stat-icon rd-route-stat-icon-green">
                          <Clock size={16} />
                        </div>
                        <div className="rd-route-stat-value">{routeDuration || "—"}</div>
                        <div className="rd-route-stat-label">Est. Time</div>
                      </div>
                      <div className="rd-route-stat">
                        <div className="rd-route-stat-icon rd-route-stat-icon-indigo">
                          <Compass size={16} />
                        </div>
                        <div className="rd-route-stat-value">
                          {officerLoc ? "On Route" : "No Officer"}
                        </div>
                        <div className="rd-route-stat-label">Status</div>
                      </div>
                    </div>
                    <div className="rd-map-legend">
                      <div className="rd-map-legend-item">
                        <span className="rd-map-legend-dot" style={{ background: "#DC2626" }} />
                        Incident
                      </div>
                      {report.resident?.latitude != null && (
                        <div className="rd-map-legend-item">
                          <span className="rd-map-legend-dot" style={{ background: "#10B981" }} />
                          Resident
                        </div>
                      )}
                      <div className="rd-map-legend-item">
                        <span className="rd-map-legend-dot" style={{ background: "#2563eb" }} />
                        Officer
                      </div>
                      <div className="rd-map-legend-item">
                        <span className="rd-map-legend-line" />
                        Route
                      </div>
                    </div>
                  </>
                )}
              </div>

              {actionUpdates.length > 0 && (
                <div className="rd-card rd-card-timeline" style={{ flex: "0 0 260px", minWidth: 0, "--rd-accent": "#8b5cf6" } as React.CSSProperties}>
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
                            {u.officer && (
                              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4, fontSize: 11, color: "var(--gray-400)" }}>
                                <Shield size={10} /> {u.officer.full_name} ({u.officer.rank})
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {actionUpdates.length > 0 && (
                <div className="rd-card rd-card-response" style={{ flex: "0 0 260px", minWidth: 0, "--rd-accent": "#14b8a6" } as React.CSSProperties}>
                  <div className="rd-card-head">
                    <MessageSquare size={13} />
                    <span>Response Details</span>
                    <span className="rd-card-badge">
                      {actionUpdates.filter((u: any) => RESPONSE_DETAIL_TYPES.includes(u.action_type)).length}
                    </span>
                  </div>
                  <div className="rd-timeline">
                    {actionUpdates
                      .filter((u: any) => RESPONSE_DETAIL_TYPES.includes(u.action_type))
                      .map((u: any, i: number, arr: any[]) => {
                        const isLast = i === arr.length - 1;
                        return (
                          <div key={u.id} className="rd-tl-item">
                            <div className="rd-tl-track">
                              <div className="rd-tl-dot" style={{ borderColor: "#14b8a6" }} />
                              {!isLast && <div className="rd-tl-line" style={{ background: "#14b8a6" }} />}
                            </div>
                            <div className="rd-tl-body">
                              <div className="rd-tl-top">
                                <span className="rd-tl-action">{u.action_type?.replace(/_/g, " ")}</span>
                                <span className="rd-tl-time">
                                  {formatDateShort(u.created_at)} at {formatTime(u.created_at)}
                                </span>
                              </div>
                              {u.description && <p className="rd-tl-desc">{u.description}</p>}
                              {u.officer && (
                                <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4, fontSize: 11, color: "var(--gray-400)" }}>
                                  <Shield size={10} /> {u.officer.full_name} ({u.officer.rank})
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    {actionUpdates.filter((u: any) => RESPONSE_DETAIL_TYPES.includes(u.action_type)).length === 0 && (
                      <div style={{ fontSize: 12, color: "var(--gray-500)", fontStyle: "italic", padding: "8px 0" }}>
                        No response details recorded yet.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {relatedReports.length > 0 && (
            <div className="rd-card rd-card-related" style={{ "--rd-accent": "#f59e0b" } as React.CSSProperties}>
              <div className="rd-card-head">
                <AlertTriangle size={13} />
                <span>Related Reports</span>
                <span className="rd-card-badge">{relatedReports.length}</span>
              </div>
              <div className="rd-related-list">
                {relatedReports.map((r) => {
                  const rStatus = statusColors[r.status] || statusColors.dismissed;
                  const RIcon = statusIcons[r.status] || Clock;
                  return (
                    <button
                      key={r.id}
                      className="rd-related-item"
                      onClick={() => navigate(`/dashboard/reports/${r.id}`)}
                    >
                      <span className="rd-related-crime">{r.crime_type?.replace(/-/g, " ")}</span>
                      <span className="rd-related-meta">
                        <MapPin size={11} /> {r.location_address || "—"}
                      </span>
                      <span className="rd-related-meta">
                        <Clock size={11} /> {formatDateShort(r.created_at)}
                      </span>
                      <span className="rd-related-status" style={{ color: rStatus.text }}>
                        <RIcon size={11} />
                        {r.status?.replace(/-/g, " ")}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

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
                      {acceptedAt && (
                        <div className="rd-officer-row" style={{ color: "#3b82f6", fontWeight: 600 }}><Clock size={10} /> Accepted {formatDateShort(acceptedAt)} at {formatTime(acceptedAt)}</div>
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
  reportId,
  latitude,
  longitude,
  label,
  residentLatitude,
  residentLongitude,
  residentLabel,
  officerLoc,
  routeData,
}: {
  reportId: string;
  latitude: number;
  longitude: number;
  label?: string;
  residentLatitude?: number | null;
  residentLongitude?: number | null;
  residentLabel?: string;
  officerLoc?: { latitude: number; longitude: number; heading?: number | null } | null;
  routeData?: { geometry: { coordinates: [number, number][] } } | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const maplibreRef = useRef<any>(null);
  const officerMarkerRef = useRef<any>(null);
  const officerLocRef = useRef<any>(null);
  const drawOfficerRef = useRef<(() => void) | null>(null);
  const fitDoneRef = useRef(false);
  const routeDataRef = useRef<any>(null);

  // Initialize map once
  useEffect(() => {
    let map: any = null;
    let cancelled = false;
    import("maplibre-gl").then((maplibregl: any) => {
      if (cancelled || !containerRef.current) return;
      maplibreRef.current = maplibregl;
      map = new maplibregl.Map({
        container: containerRef.current,
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: [longitude, latitude],
        zoom: 14,
      });
      mapRef.current = map;

      new maplibregl.Marker({ color: "#DC2626" })
        .setLngLat([longitude, latitude])
        .setPopup(
          new maplibregl.Popup().setHTML(
            `<div class="popup-content"><h4>${label || "Location"}</h4></div>`
          )
        )
        .addTo(map);

      if (residentLatitude != null && residentLongitude != null) {
        new maplibregl.Marker({ color: "#10B981" })
          .setLngLat([residentLongitude, residentLatitude])
          .setPopup(
            new maplibregl.Popup().setHTML(
              `<div class="popup-content"><h4>${residentLabel || "Resident"}</h4></div>`
            )
          )
          .addTo(map);
      }

      map.on("load", () => {
        map.addSource("route", {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } },
        });
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#EF4444",
            "line-width": 5,
            "line-opacity": 0.85,
          },
        });
        // Render any route that was fetched before the map finished loading
        if (routeDataRef.current?.geometry?.coordinates?.length) {
          (map.getSource("route") as any)?.setData({
            type: "Feature",
            properties: {},
            geometry: routeDataRef.current.geometry,
          });
          const bounds = routeDataRef.current.geometry.coordinates.reduce(
            (b: any, c: [number, number]) => b.extend(c),
            new maplibregl.LngLatBounds()
          );
          if (bounds && !fitDoneRef.current) {
            map.fitBounds(bounds, { padding: 60, duration: 800 });
            fitDoneRef.current = true;
          }
        }
        // Render the officer arrow if its location arrived before the map loaded
        drawOfficerRef.current?.();
      });

      const loadPosts = async () => {
        try {
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
        } catch (e) {
          console.warn("Failed to load police posts:", e);
        }
      };
      loadPosts();
    });
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
  }, [latitude, longitude, residentLatitude, residentLongitude, residentLabel, label]);

  // Draw / update officer marker (plain blue police icon)
  const drawOfficer = useCallback(() => {
    const map = mapRef.current;
    const maplibregl = maplibreRef.current;
    const loc = officerLocRef.current;
    if (!map || !maplibregl || !loc) return;

    const el = document.createElement("div");
    el.className = "rd-officer-marker";
    el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:26px;height:26px;"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;

    let marker = officerMarkerRef.current;
    if (marker) {
      marker.getElement().innerHTML = el.innerHTML;
      marker.getElement().className = el.className;
      marker.setLngLat([loc.longitude, loc.latitude]);
    } else {
      marker = new maplibregl.Marker({ element: el })
        .setLngLat([loc.longitude, loc.latitude])
        .addTo(map);
      officerMarkerRef.current = marker;
    }
  }, []);

  useEffect(() => {
    officerLocRef.current = officerLoc;
    drawOfficerRef.current = drawOfficer;
    if (officerLoc) drawOfficer();
  }, [officerLoc, drawOfficer]);

  // Draw the route line
  useEffect(() => {
    routeDataRef.current = routeData;

    const map = mapRef.current;
    if (!map) return;

    const applyRoute = () => {
      if (!routeData?.geometry?.coordinates?.length) return;
      const src = map.getSource("route");
      if (!src) return;
      (src as any).setData({
        type: "Feature",
        properties: {},
        geometry: routeData.geometry,
      });
      if (!fitDoneRef.current && maplibreRef.current) {
        const bounds = routeData.geometry.coordinates.reduce(
          (b: any, c: [number, number]) => b.extend(c),
          new maplibreRef.current.LngLatBounds()
        );
        map.fitBounds(bounds, { padding: 60, duration: 800 });
        fitDoneRef.current = true;
      }
    };

    if (map.isStyleLoaded() && map.getSource("route")) {
      applyRoute();
    } else if (map.isStyleLoaded()) {
      // source not created yet (shouldn't happen), re-check after a tick
      setTimeout(applyRoute, 0);
    }
    // If the style is still loading, the map "load" handler applies latest routeDataRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeData]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
