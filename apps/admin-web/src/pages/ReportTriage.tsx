import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { useAuth } from "../context/AuthContext";
import { useAlarm } from "../context/AlarmContext";
import { useToast } from "../context/ToastContext";
import type { CrimeReport } from "../types";
import {
  ClipboardCheck, Search, Filter, ChevronLeft, ChevronRight,
  CheckCircle2, XCircle, Eye, MapPin, AlertOctagon, Zap, ShieldCheck,
  X, Activity, Info, Siren, UserCheck
} from "lucide-react";

const ITEMS_PER_PAGE = 15;

const URGENCY_LEVELS = ["critical", "high", "medium", "low"] as const;
const URGENCY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const DEFAULT_CRIME_TYPES = ["hit-and-run", "robbery", "theft", "assault", "vandalism", "burglary", "emergency", "others"];

// Reports the dispatch team has not acted on yet (first response targets)
const FIRST_RESPONSE_STATUSES = ["pending", "under-review"];
const ACTIVE_STATUSES = ["pending", "under-review", "in-progress", "investigating", "needs-backup"];

const urgencyLabel = (u?: string) => u || "medium";

// ---- Client-side triage fallback ----
// Mirrors public.compute_triage_score() in db/migrations/043_add_auto_triage.sql.
// Used only when the DB column `triage_score` is missing (migration 043 not yet
// applied) so the admin can still see a meaningful priority score.
const BASE_SCORE: Record<string, number> = {
  emergency: 95,
  "hit-and-run": 85,
  robbery: 80,
  assault: 70,
  burglary: 65,
  theft: 45,
  vandalism: 30,
  "lost-item": 25,
  noise: 25,
  complaint: 25,
  accident: 25,
};

const CRITICAL_KEYWORDS = [
  "gun", "firearm", "knife", "weapon", "armed", "shooting", "shots", "shot",
  "stabbed", "stabbing", "dead", "killed", "killing", "murder", "unconscious",
  "bleeding", "blood", "hostage", "kidnapp", "abduct", "drowning", "explosion",
  "bomb", "burning", "carjacking", "hijack",
];
const URGENT_KEYWORDS = [
  "in progress", "in-progress", "right now", "immediately", "urgent",
  "emergency", "danger", "threat", "asap", "ongoing", "on-going", "happening now",
];
const VULNERABLE_KEYWORDS = [
  "child", "children", "student", "school ", "elderly", "disabled", "pregnant",
];
const DOUBT_KEYWORDS = [
  "false report", "joke", "prank", "hoax", "just checking", "already resolved",
  "mistaken", "accidentally submitted", "never happened", "not real",
];

const hasAny = (text: string, keywords: string[]) => keywords.some((k) => text.includes(k));

const computeTriageScore = (r: CrimeReport): number => {
  const type = (r.crime_type || "").toLowerCase();
  const desc = (r.description || "").toLowerCase();
  let score = BASE_SCORE[type] ?? 45;

  if (desc) {
    if (hasAny(desc, CRITICAL_KEYWORDS)) score += 15;
    if (hasAny(desc, URGENT_KEYWORDS)) score += 10;
    if (hasAny(desc, VULNERABLE_KEYWORDS)) score += 8;
    if (hasAny(desc, DOUBT_KEYWORDS)) score -= 25;
    if ((r.description || "").length >= 40) score += 3;
  } else {
    score -= 8;
  }

  if (r.share_live_location) score += 8;
  if (r.photo_url) score += 5;
  if (r.latitude != null && r.longitude != null) score += 3;
  else score -= 6;

  const hour = r.created_at ? new Date(r.created_at).getHours() : -1;
  if (Number.isFinite(hour) && (hour >= 22 || hour < 5)) score += 5;

  return Math.max(0, Math.min(100, score));
};

const urgencyForScore = (score: number) =>
  score >= 75 ? "critical" : score >= 55 ? "high" : score >= 30 ? "medium" : "low";

const effectiveScore = (r: CrimeReport): number =>
  typeof r.triage_score === "number" ? r.triage_score : computeTriageScore(r);

// Priority shown for a report: use the DB-assigned value once present,
// otherwise derive one from the (client-computed or DB) score.
const effectiveUrgency = (r: CrimeReport): string => {
  if (typeof r.triage_score === "number") return urgencyLabel(r.urgency);
  if (r.urgency && r.urgency !== "medium") return r.urgency;
  return urgencyForScore(effectiveScore(r));
};

const getArea = (address?: string): string => {
  if (!address) return "Unknown";
  const parts = address.split(",").map((s) => s.trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    if (/^(calbayog|calbayog\s+city|city\s+of\s+calbayog|samar|philippines|philippines\.|region\s*\d+)$/i.test(part)) continue;
    return part;
  }
  return "Unknown";
};

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function ReportTriage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refreshAlarm } = useAlarm();
  const { toast } = useToast();

  const [reports, setReports] = useState<CrimeReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("first");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [crimeFilter, setCrimeFilter] = useState("all");
  const [areaFilter, setAreaFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [updatedId, setUpdatedId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [actionMode, setActionMode] = useState<"validate" | "dismiss">("validate");
  const [activeReport, setActiveReport] = useState<CrimeReport | null>(null);
  const [notes, setNotes] = useState("");
  const [modalUrgency, setModalUrgency] = useState("medium");
  const [modalCrimeType, setModalCrimeType] = useState("others");
  const [submitting, setSubmitting] = useState(false);

  const loadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadReports = async () => {
    try {
      const { data, error } = await supabase
        .from("crime_reports")
        .select("*")
        .order("created_at", { ascending: false });
      if (!error) {
        const withProfiles = await Promise.all(
          (data ?? []).map(async (r: any) => {
            const { data: rp } = await supabase
              .from("resident_profiles")
              .select("full_name, phone_number, address")
              .eq("id", r.resident_id)
              .maybeSingle();
            return { ...r, resident: rp || null };
          })
        );
        setReports(withProfiles);
      }
    } catch (err) {
      console.error("Failed to load reports:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
    const channel = supabase
      .channel("admin-report-triage")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "crime_reports" },
        (payload: any) => {
          if (loadTimer.current) clearTimeout(loadTimer.current);
          loadTimer.current = setTimeout(() => loadReports(), 400);
          if (payload.new?.id) setUpdatedId(payload.new.id);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      if (loadTimer.current) clearTimeout(loadTimer.current);
    };
  }, []);

  const updateUrgency = async (id: string, urgency: string) => {
    setUpdatedId(id);
    const prev = reports.find((r) => r.id === id);
    setReports((prevList) =>
      prevList.map((r) => (r.id === id ? { ...r, urgency } : r))
    );
    const { error } = await supabase
      .from("crime_reports")
      .update({ urgency, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      setReports((prevList) =>
        prevList.map((r) => (r.id === id ? { ...r, urgency: prev?.urgency || "medium" } : r))
      );
      toast(`Failed to update priority: ${error.message}`, "error");
      return;
    }
    toast(`Priority set to ${urgency.replace(/-/g, " ")}`, "success");
  };

  const openModal = (mode: "validate" | "dismiss", r: CrimeReport) => {
    setActionMode(mode);
    setActiveReport(r);
    setNotes(r.validation_notes || "");
    setModalUrgency(r.urgency || "medium");
    setModalCrimeType(r.crime_type || "others");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (submitting) return;
    setModalOpen(false);
    setActiveReport(null);
    setNotes("");
  };

  const submitAction = async () => {
    const r = activeReport;
    if (!r) return;
    setSubmitting(true);
    try {
      const payload: any = {
        urgency: modalUrgency,
        validated_by: user?.id || null,
        validated_at: new Date().toISOString(),
        validation_notes: notes.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (actionMode === "validate") {
        payload.is_validated = true;
        payload.crime_type = modalCrimeType;
        if (r.status === "pending") payload.status = "under-review";
      } else {
        payload.is_validated = false;
        payload.status = "dismissed";
      }

      const { error } = await supabase.from("crime_reports").update(payload).eq("id", r.id);
      if (error) throw error;

      if (actionMode === "dismiss") {
        await supabase.from("action_updates").insert({
          report_id: r.id,
          action_type: "dismissed",
          officer_id: null,
          description: "Report was reviewed and dismissed as invalid" + (notes.trim() ? `: ${notes.trim()}` : "."),
          created_at: new Date().toISOString(),
        });
        if (r.resident_id) {
          await supabase.from("notifications").insert({
            user_id: r.resident_id,
            type: "report_update",
            title: "Report Reviewed",
            body: `Your ${(payload.crime_type || r.crime_type)?.replace(/-/g, " ") || "report"} was reviewed and marked invalid${notes.trim() ? `: ${notes.trim()}` : "."}`,
            data: { report_id: r.id, status: "dismissed" },
            created_at: new Date().toISOString(),
          });
        }
        toast("Report dismissed as invalid", "success");
      } else {
        toast(`Report validated as ${modalUrgency.replace(/-/g, " ")} priority`, "success");
      }

      refreshAlarm();
      closeModal();
      loadReports();
    } catch (err) {
      console.error("Failed to triage report:", err);
      toast("Failed to save validation", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const crimeOptions = Array.from(new Set([...DEFAULT_CRIME_TYPES, ...reports.map((r) => r.crime_type || "").filter(Boolean)])).sort();
  const areaOptions = Array.from(new Set(reports.map((r) => getArea(r.location_address)))).sort((a, b) => a.localeCompare(b));

  const firstResponseCount = reports.filter((r) => FIRST_RESPONSE_STATUSES.includes(r.status)).length;
  const validatedCount = reports.filter((r) => r.is_validated).length;
  const invalidCount = reports.filter((r) => r.status === "dismissed").length;
  const criticalCount = reports.filter((r) => urgencyLabel(r.urgency) === "critical" && ACTIVE_STATUSES.includes(r.status)).length;
  const highCount = reports.filter((r) => urgencyLabel(r.urgency) === "high" && ACTIVE_STATUSES.includes(r.status)).length;

  const filtered = reports.filter((r) => {
    if (statusFilter === "first" && !FIRST_RESPONSE_STATUSES.includes(r.status)) return false;
    if (statusFilter === "active" && !ACTIVE_STATUSES.includes(r.status)) return false;
    if (statusFilter === "validated" && !r.is_validated) return false;
    if (statusFilter === "dismissed" && r.status !== "dismissed") return false;
    if (urgencyFilter !== "all" && effectiveUrgency(r) !== urgencyFilter) return false;
    if (crimeFilter !== "all" && (r.crime_type || "others") !== crimeFilter) return false;
    if (areaFilter !== "all" && getArea(r.location_address) !== areaFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const matches =
        r.crime_type?.toLowerCase().includes(q) ||
        r.resident?.full_name?.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q) ||
        r.location_address?.toLowerCase().includes(q);
      if (!matches) return false;
    }
    return true;
  });

  // Priority queue: most urgent first, then by score, then newest
  const sorted = [...filtered].sort((a, b) => {
    const au = URGENCY_ORDER[effectiveUrgency(a)] ?? 2;
    const bu = URGENCY_ORDER[effectiveUrgency(b)] ?? 2;
    if (au !== bu) return au - bu;
    const as = effectiveScore(a);
    const bs = effectiveScore(b);
    if (as !== bs) return bs - as;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE);
  const paged = sorted.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, urgencyFilter, crimeFilter, areaFilter, search]);

  const statCards = [
    {
      key: "first",
      label: "Needs First Response",
      value: firstResponseCount,
      icon: Siren,
      color: "#ef4444",
      active: statusFilter === "first",
    },
    {
      key: "critical",
      label: "Critical Active",
      value: criticalCount,
      icon: AlertOctagon,
      color: "#f87171",
      active: statusFilter === "first" && urgencyFilter === "critical",
    },
    {
      key: "high",
      label: "High Active",
      value: highCount,
      icon: Zap,
      color: "#fb923c",
      active: statusFilter === "first" && urgencyFilter === "high",
    },
    {
      key: "validated",
      label: "Validated",
      value: validatedCount,
      icon: UserCheck,
      color: "#10b981",
      active: statusFilter === "validated",
    },
    {
      key: "dismissed",
      label: "Dismissed (Invalid)",
      value: invalidCount,
      icon: XCircle,
      color: "#64748b",
      active: statusFilter === "dismissed",
    },
  ];

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
        <h2 style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ClipboardCheck size={20} /> Report Validation & Triage
        </h2>
        <span style={{ fontSize: 13, color: "var(--gray-400)" }}>
          Auto-prioritized &middot; {firstResponseCount} awaiting first response
        </span>
      </div>
      <div className="page-body">
        <div className="stats-grid">
          {statCards.map((s) => (
            <div
              key={s.key}
              className={`stat-card clickable${s.active ? " triage-stat-active" : ""}`}
              onClick={() => {
                if (s.key === "critical" || s.key === "high") {
                  setStatusFilter("first");
                  setUrgencyFilter(s.key);
                  return;
                }
                setStatusFilter(s.key);
                setUrgencyFilter("all");
              }}
              style={{ border: s.active ? `1px solid ${s.color}` : undefined }}
            >
              <div className="stat-icon" style={{ background: `${s.color}18`, color: s.color }}>
                <s.icon size={22} />
              </div>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value">{s.value}</div>
            </div>
          ))}
        </div>

        <div
          style={{
            display: "flex", alignItems: "center", gap: 10, marginBottom: 18,
            padding: "12px 16px", borderRadius: 10,
            background: "rgba(96,165,250,0.08)",
            border: "1px solid rgba(96,165,250,0.2)",
            fontSize: 13, color: "var(--gray-500)", lineHeight: 1.5,
          }}
        >
          <Activity size={16} style={{ color: "#60a5fa", flexShrink: 0 }} />
          <span>
            Reports are <b style={{ color: "var(--gray-700)" }}>auto-validated and prioritized</b> on submission using a
            triage score (incident type, description signals, evidence, live location, GPS &amp; time). Most urgent
            incidents appear first — clicking <b style={{ color: "var(--gray-700)" }}>Validate</b> confirms,{" "}
            <b style={{ color: "var(--gray-700)" }}>Dismiss</b> rejects, and the dropdown overrides priority manually.
          </span>
        </div>

        <div className="filters-bar">
          <Filter size={16} style={{ color: "var(--gray-400)" }} />
          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="first">Needs First Response</option>
            <option value="active">All Active</option>
            <option value="validated">Validated</option>
            <option value="dismissed">Dismissed</option>
            <option value="all">All Reports</option>
          </select>
          <select
            className="filter-select"
            value={urgencyFilter}
            onChange={(e) => setUrgencyFilter(e.target.value)}
          >
            <option value="all">All Priority</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select
            className="filter-select"
            value={crimeFilter}
            onChange={(e) => setCrimeFilter(e.target.value)}
          >
            <option value="all">All Incident Types</option>
            {crimeOptions.map((c) => (
              <option key={c} value={c}>{c.replace(/-/g, " ")}</option>
            ))}
          </select>
          <select
            className="filter-select"
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
          >
            <option value="all">All Locations</option>
            {areaOptions.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
            <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--gray-400)" }} />
            <input
              className="search-input"
              style={{ paddingLeft: 36 }}
              placeholder="Search type, resident, location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className="filter-count">{sorted.length} results</span>
        </div>

        {sorted.length > 0 ? (
          <>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Incident Type</th>
                    <th>Reporter</th>
                    <th>Location</th>
                    <th>Triage Score</th>
                    <th>Priority</th>
                    <th>Validation</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th style={{ width: 70 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((r) => {
                    const score = effectiveScore(r);
                    const level = effectiveUrgency(r);
                    return (
                      <tr
                        key={r.id}
                        className={`clickable-row${updatedId === r.id ? " triage-row-flash" : ""}${level === "critical" ? " triage-critical-row" : ""}${level === "high" ? " triage-high-row" : ""}`}
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest("button, select, input")) return;
                          navigate(`/dashboard/reports/${r.id}`);
                        }}
                      >
                        <td style={{ textTransform: "capitalize", fontWeight: 600 }}>
                          {r.crime_type?.replace(/-/g, " ")}
                        </td>
                        <td>
                          <div style={{ fontWeight: 500 }}>{r.resident?.full_name || "Unknown"}</div>
                          <div style={{ fontSize: 12, color: "var(--gray-400)" }}>
                            {r.resident?.phone_number || ""}
                          </div>
                        </td>
                        <td style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <MapPin size={12} style={{ color: "var(--gray-400)", flexShrink: 0 }} />
                            {r.location_address || `${Number(r.latitude || 0).toFixed(4)}, ${Number(r.longitude || 0).toFixed(4)}` || "—"}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--gray-500)", marginTop: 2 }}>
                            {getArea(r.location_address)}
                          </div>
                        </td>
                        <td>
                          <div
                            className="triage-score-row"
                            title={r.validation_notes || `Auto score ${score}/100`}
                          >
                            <span
                              className={`triage-score-val triage-score-${level}`}
                              style={{ fontWeight: 700, fontSize: 13 }}
                            >
                              {score}/100
                            </span>
                            <div className="triage-scorebar">
                              <div
                                className={`triage-scorebar-fill triage-scorebar-${level}`}
                                style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span className={`badge badge-${level}`}>{level}</span>
                            <select
                              className="triage-urgency-select"
                              value={level}
                              onChange={(e) => {
                                e.stopPropagation();
                                updateUrgency(r.id, e.target.value);
                              }}
                              title="Override auto priority"
                            >
                              {URGENCY_LEVELS.map((u) => (
                                <option key={u} value={u}>{u}</option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td>
                          {r.is_validated && !r.validated_by ? (
                            <span className="badge badge-auto" title={r.validation_notes}>
                              <Activity size={11} /> Auto
                            </span>
                          ) : r.is_validated ? (
                            <span className="badge badge-validated" title={r.validation_notes}>
                              <UserCheck size={11} /> Validated
                            </span>
                          ) : r.status === "dismissed" ? (
                            <span className="badge badge-dismissed">Invalid</span>
                          ) : (
                            <span className="badge badge-pending"><ClockIcon /> Pending</span>
                          )}
                          {r.validation_notes && (
                            <button
                              onClick={(e) => { e.stopPropagation(); toast(r.validation_notes || "", "info"); }}
                              title="Why this priority?"
                              style={actionBtnStyle("var(--gray-400)")}
                              onMouseOver={(e) => (e.currentTarget.style.color = "#60a5fa")}
                              onMouseOut={(e) => (e.currentTarget.style.color = "var(--gray-400)")}
                            >
                              <Info size={13} />
                            </button>
                          )}
                        </td>
                        <td>
                          <span className={`badge badge-${r.status}`}>{r.status}</span>
                        </td>
                        <td style={{ color: "var(--gray-400)", fontSize: 13 }}>
                          {formatDate(r.created_at)}
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            {!r.is_validated && r.status !== "dismissed" && (
                              <button
                                onClick={(e) => { e.stopPropagation(); openModal("validate", r); }}
                                title="Validate report"
                                style={actionBtnStyle("#10b981")}
                                onMouseOver={(e) => (e.currentTarget.style.background = "rgba(16,185,129,0.15)")}
                                onMouseOut={(e) => (e.currentTarget.style.background = "none")}
                              >
                                <CheckCircle2 size={15} />
                              </button>
                            )}
                            {r.status !== "dismissed" && (
                              <button
                                onClick={(e) => { e.stopPropagation(); openModal("dismiss", r); }}
                                title={r.is_validated ? "Mark as invalid" : "Dismiss as invalid"}
                                style={actionBtnStyle("#ef4444")}
                                onMouseOver={(e) => (e.currentTarget.style.background = "rgba(239,68,68,0.15)")}
                                onMouseOut={(e) => (e.currentTarget.style.background = "none")}
                              >
                                <XCircle size={15} />
                              </button>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/reports/${r.id}`); }}
                              title="View details"
                              style={actionBtnStyle("var(--gray-400)")}
                              onMouseOver={(e) => (e.currentTarget.style.background = "rgba(96,165,250,0.15)")}
                              onMouseOut={(e) => (e.currentTarget.style.background = "none")}
                            >
                              <Eye size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 20 }}>
                <button
                  className="btn btn-sm btn-outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    className={`btn btn-sm ${p === page ? "btn-primary" : "btn-ghost"}`}
                    onClick={() => setPage(p)}
                    style={{ minWidth: 36 }}
                  >
                    {p}
                  </button>
                ))}
                <button
                  className="btn btn-sm btn-outline"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-icon"><ClipboardCheck size={24} /></div>
            <h3>No reports to show</h3>
            <p>
              {statusFilter !== "first" || urgencyFilter !== "all" || crimeFilter !== "all" || areaFilter !== "all" || search
                ? "Try changing the filters or search term"
                : "No incidents awaiting first response right now"}
            </p>
          </div>
        )}
      </div>

      {modalOpen && activeReport && (
        <>
          <div
            onClick={() => !submitting && closeModal()}
            style={{
              position: "fixed", inset: 0, zIndex: 9998,
              background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
              animation: "fadeIn 0.2s ease-out",
            }}
          />
          <div
            style={{
              position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
              zIndex: 9999, width: 460, maxWidth: "92vw",
              background: "var(--gray-100)", borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
              animation: "alertSlideIn 0.3s cubic-bezier(0.16,1,0.3,1)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "24px 24px 0", display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: actionMode === "validate" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                {actionMode === "validate" ? (
                  <ShieldCheck size={22} color="#10b981" />
                ) : (
                  <XCircle size={22} color="#ef4444" />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--gray-900)", marginBottom: 4 }}>
                  {actionMode === "validate" ? "Confirm Validation & Priority" : "Dismiss Report as Invalid"}
                </div>
                <div style={{ fontSize: 13, color: "var(--gray-500)", lineHeight: 1.5 }}>
                  <span style={{ textTransform: "capitalize", fontWeight: 600, color: "var(--gray-700)" }}>
                    {activeReport.crime_type?.replace(/-/g, " ")}
                  </span>{" "}
                  reported by {activeReport.resident?.full_name || "Unknown"}{" "}
                  at {activeReport.location_address || "unknown location"}.
                  {typeof activeReport.triage_score === "number" && (
                    <> Auto score {activeReport.triage_score}/100.</>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "var(--gray-500)" }}>
                  Triage score: <strong>{effectiveScore(activeReport)}/100</strong> · Priority: <strong>{effectiveUrgency(activeReport)}</strong>
                  {!activeReport.validated_by && typeof activeReport.triage_score !== "number" && (
                    <span> (estimated in-app — run migration 043 for server-side scoring)</span>
                  )}
                </div>
              </div>
              <button
                onClick={closeModal}
                disabled={submitting}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gray-500)", padding: 2, lineHeight: 0 }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={fieldLabelStyle}>Priority</label>
                  <select
                    className="filter-select"
                    style={{ width: "100%", minWidth: 0 }}
                    value={modalUrgency}
                    onChange={(e) => setModalUrgency(e.target.value)}
                  >
                    {URGENCY_LEVELS.map((u) => (
                      <option key={u} value={u}>{u.replace(/-/g, " ")} Priority</option>
                    ))}
                  </select>
                </div>
                {actionMode === "validate" && (
                  <div style={{ flex: 1 }}>
                    <label style={fieldLabelStyle}>Incident Type</label>
                    <select
                      className="filter-select"
                      style={{ width: "100%", minWidth: 0 }}
                      value={modalCrimeType}
                      onChange={(e) => setModalCrimeType(e.target.value)}
                    >
                      {crimeOptions.map((c) => (
                        <option key={c} value={c}>{c.replace(/-/g, " ")}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label style={fieldLabelStyle}>
                  {actionMode === "validate" ? "Validation Notes" : "Reason for Dismissal"}
                </label>
                <textarea
                  rows={3}
                  placeholder={
                    actionMode === "validate"
                      ? "Notes about the validity, witnesses, or triage decision..."
                      : "Example: No evidence found, false alarm, duplicate report..."
                  }
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{
                    width: "100%", padding: "10px 14px", fontSize: 13,
                    border: "1.5px solid var(--gray-300)", borderRadius: 8,
                    background: "var(--gray-100)", color: "var(--gray-700)",
                    resize: "vertical", fontFamily: "inherit",
                    outline: "none", lineHeight: 1.5,
                  }}
                />
              </div>
            </div>

            <div style={{ padding: "0 24px 24px", display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={closeModal}
                disabled={submitting}
                className="btn btn-sm btn-outline"
              >
                Cancel
              </button>
              <button
                onClick={submitAction}
                disabled={submitting}
                className={`btn btn-sm ${actionMode === "validate" ? "btn-primary" : "btn-danger"}`}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                {submitting ? (
                  "Saving..."
                ) : actionMode === "validate" ? (
                  <><CheckCircle2 size={15} /> Confirm</>
                ) : (
                  <><XCircle size={15} /> Dismiss</>
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function ClockIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

const actionBtnStyle = (color: string): React.CSSProperties => ({
  background: "none", border: "none", cursor: "pointer",
  color, padding: 5, borderRadius: 6, transition: "background 0.15s, color 0.15s", lineHeight: 0,
});

const fieldLabelStyle: React.CSSProperties = {
  display: "block", fontSize: 12, fontWeight: 600,
  color: "var(--gray-500)", marginBottom: 6, letterSpacing: 0.2,
};