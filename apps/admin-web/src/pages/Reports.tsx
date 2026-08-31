import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { useAlarm } from "../context/AlarmContext";
import type { CrimeReport } from "../types";
import { useToast } from "../context/ToastContext";
import { Search, Filter, FileText, ChevronLeft, ChevronRight, Trash2, AlertTriangle, X } from "lucide-react";

const ITEMS_PER_PAGE = 15;

export default function Reports() {
  const navigate = useNavigate();
  const { refreshAlarm } = useAlarm();
  const { toast } = useToast();
  const [reports, setReports] = useState<CrimeReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const deleteIdRef = useRef<string | null>(null);

  useEffect(() => {
    loadReports();
    const channel = supabase
      .channel("admin-reports")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "crime_reports" },
        () => loadReports()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

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
            let assignedOfficer = null;
            if (r.assigned_officer_id) {
              const { data: op } = await supabase
                .from("police_profiles")
                .select("full_name, badge_id, rank")
                .eq("id", r.assigned_officer_id)
                .maybeSingle();
              assignedOfficer = op || null;
            }
            return { ...r, resident: rp || null, assigned_officer: assignedOfficer };
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

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const handleDelete = async () => {
    const id = deleteIdRef.current;
    if (!id) return;
    setDeleting(true);
    try {
      const { data: report } = await supabase
        .from("crime_reports")
        .select("photo_url")
        .eq("id", id)
        .single();

      if (report?.photo_url) {
        const filenames = report.photo_url
          .split(",")
          .map((u: string) => u.trim())
          .filter(Boolean)
          .map((url: string) => {
            try { return new URL(url).pathname.split("/").pop() || null; }
            catch { return null; }
          })
          .filter(Boolean) as string[];
        if (filenames.length > 0) {
          for (const name of filenames) {
            const { error } = await supabase.storage.from("report-photos").remove([name]);
            if (error) console.warn(`Storage delete failed for ${name}: ${error.message}`);
          }
        }
      }

      const { error } = await supabase.from("crime_reports").delete().eq("id", id);
      if (error) throw error;
      refreshAlarm();
      loadReports();
      deleteIdRef.current = null;
      setShowDeleteModal(false);
    } catch (err) {
      console.error("Failed to delete report:", err);
    } finally {
      setDeleting(false);
    }
  };

  const promptDelete = (id: string) => {
    deleteIdRef.current = id;
    setShowDeleteModal(true);
  };

  const filtered = reports.filter((r) => {
    if (filter !== "all" && r.status !== filter) return false;
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

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paged = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  useEffect(() => {
    setPage(1);
  }, [filter, search]);

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
        <h2>Reports Management</h2>
        <span style={{ fontSize: 13, color: "var(--gray-400)" }}>
          {reports.length} total reports
        </span>
      </div>
      <div className="page-body">
        <div className="filters-bar">
          <Filter size={16} style={{ color: "var(--gray-400)" }} />
          <select
            className="filter-select"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="under-review">Under Review</option>
            <option value="in-progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
            <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--gray-400)" }} />
            <input
              className="search-input"
              style={{ paddingLeft: 36 }}
              placeholder="Search by type, resident, description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className="filter-count">{filtered.length} results</span>
        </div>

        {filtered.length > 0 ? (
          <>
            <div className="report-grid">
              {paged.map((r) => (
                <div
                  key={r.id}
                  className="report-card report-card-clickable"
                  onClick={() => navigate(`/dashboard/reports/${r.id}`)}
                >
                  <div className="report-card-head">
                    <div className="report-card-crime">
                      <span className={`report-icon report-icon-${r.status}`}>
                        <FileText size={16} />
                      </span>
                      <span className="report-crime-type">
                        {r.crime_type?.replace(/-/g, " ")}
                      </span>
                    </div>
                    <span className={`badge badge-${r.status}`}>{r.status}</span>
                  </div>

                  <div className="report-card-body">
                    <div className="report-card-resident">
                      <span className="report-card-resident-name">
                        {r.resident?.full_name || "Unknown"}
                      </span>
                      {r.resident?.phone_number && (
                        <span className="report-card-phone">{r.resident.phone_number}</span>
                      )}
                    </div>
                    <div className="report-card-address">
                      {r.location_address || `${r.latitude?.toFixed(4)}, ${r.longitude?.toFixed(4)}` || "—"}
                    </div>
                  </div>

                  <div className="report-card-foot">
                    <div className="report-card-meta">
                      <span className="report-date">
                        {formatDate(r.created_at)}
                      </span>
                      {r.assigned_officer && (
                        <span className="report-officer-chip" title="Accepted by">
                          {r.assigned_officer.full_name}
                        </span>
                      )}
                    </div>
                    <button
                      className="report-card-delete"
                      onClick={(e) => { e.stopPropagation(); promptDelete(r.id); }}
                      disabled={deleting}
                      title="Delete report"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
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
            <div className="empty-icon"><FileText size={24} /></div>
            <h3>No reports found</h3>
            <p>
              {filter !== "all" || search
                ? "Try changing the filter or search term"
                : "No reports have been submitted yet"}
            </p>
          </div>
        )}
      </div>

      {showDeleteModal && (
        <>
          <div
            onClick={() => !deleting && setShowDeleteModal(false)}
            style={{
              position: "fixed", inset: 0, zIndex: 9998,
              background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
              animation: "fadeIn 0.2s ease-out",
            }}
          />
          <div
            style={{
              position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
              zIndex: 9999, width: 360, maxWidth: "90vw",
              background: "var(--gray-100)", borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
              animation: "alertSlideIn 0.3s cubic-bezier(0.16,1,0.3,1)",
              overflow: "hidden",
            }}
          >
            <div style={{
              padding: "24px 24px 0",
              display: "flex", alignItems: "flex-start", gap: 14,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: "rgba(239,68,68,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <AlertTriangle size={22} color="#ef4444" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--gray-900)", marginBottom: 4 }}>
                  Delete Report
                </div>
                <div style={{ fontSize: 13, color: "var(--gray-500)", lineHeight: 1.5 }}>
                  This action cannot be undone. The report and all associated data will be permanently removed.
                </div>
              </div>
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--gray-500)", padding: 2, lineHeight: 0,
                }}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: "20px 24px", display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                style={{
                  padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  background: "transparent", color: "var(--gray-500)",
                  border: "1px solid var(--gray-300)", borderRadius: 8,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  background: "#ef4444", color: "#fff",
                  border: "none", borderRadius: 8,
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                <Trash2 size={15} />
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
