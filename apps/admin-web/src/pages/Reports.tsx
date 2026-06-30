import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import type { CrimeReport } from "../types";

export default function Reports() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<CrimeReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

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
        const withResidents = await Promise.all(
          (data ?? []).map(async (r: any) => {
            const { data: rp } = await supabase
              .from("resident_profiles")
              .select("full_name, phone_number, address")
              .eq("id", r.resident_id)
              .maybeSingle();
            return { ...r, resident: rp || null };
          })
        );
        setReports(withResidents);
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
        <h2>Reports Management</h2>
        <span style={{ fontSize: 13, color: "var(--gray-400)" }}>
          {reports.length} total reports
        </span>
      </div>
      <div className="page-body">
        <div className="filters-bar">
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
          <input
            className="search-input"
            placeholder="Search by type, resident, description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span style={{ fontSize: 13, color: "var(--gray-400)" }}>
            {filtered.length} results
          </span>
        </div>

        {filtered.length > 0 ? (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Crime Type</th>
                  <th>Resident</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => navigate(`/reports/${r.id}`)}
                    style={{ cursor: "pointer" }}
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
                    <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.location_address || `${r.latitude?.toFixed(4)}, ${r.longitude?.toFixed(4)}` || "—"}
                    </td>
                    <td>
                      <span className={`badge badge-${r.status}`}>{r.status}</span>
                    </td>
                    <td style={{ color: "var(--gray-400)", fontSize: 13 }}>
                      {formatDate(r.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="icon">📋</div>
            <h3>No reports found</h3>
            <p>
              {filter !== "all" || search
                ? "Try changing the filter or search term"
                : "No reports have been submitted yet"}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
