import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { AlertTriangle, Search, Filter, ChevronLeft, ChevronRight } from "lucide-react";

const ITEMS_PER_PAGE = 15;

export default function ActiveIncidents() {
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const channel = supabase
      .channel("admin-active-incidents")
      .on("postgres_changes", { event: "*", schema: "public", table: "crime_reports" }, () => load())
      .subscribe();
    load();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("crime_reports")
      .select("*")
      .in("status", ["pending", "in-progress", "needs-backup", "investigating"])
      .order("created_at", { ascending: false });
    if (data) {
      const enriched = await Promise.all(
        data.map(async (r: any) => {
          const { data: res } = await supabase
            .from("resident_profiles")
            .select("full_name, phone_number, address")
            .eq("id", r.resident_id)
            .single();
          return { ...r, resident: res };
        })
      );
      setIncidents(enriched);
    }
    setLoading(false);
  };

  const filtered = incidents.filter((r) => {
    const q = search.toLowerCase();
    const matchesSearch =
      r.crime_type?.toLowerCase().includes(q) ||
      r.description?.toLowerCase().includes(q) ||
      r.location_address?.toLowerCase().includes(q) ||
      r.resident?.full_name?.toLowerCase().includes(q);
    if (filter === "all") return matchesSearch;
    return matchesSearch && r.status === filter;
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  if (loading) return <div className="page-body"><div className="spinner" /></div>;

  return (
    <>
      <div className="page-header">
        <h2><AlertTriangle size={22} /> Active Incidents</h2>
        <span className="badge badge-pending">{filtered.length} active</span>
      </div>
      <div className="page-body">
        <div className="filters-bar">
          <div className="search-wrapper">
            <Search size={16} />
            <input
              className="search-input"
              placeholder="Search incidents..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <select className="filter-select" value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }}>
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="in-progress">In Progress</option>
            <option value="needs-backup">Needs Backup</option>
            <option value="investigating">Investigating</option>
          </select>
          <span className="filter-count">{filtered.length} results</span>
        </div>

        {paginated.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><AlertTriangle size={40} /></div>
            <h3>No active incidents</h3>
            <p>All incidents have been resolved.</p>
          </div>
        ) : (
          <>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Reporter</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((r) => (
                    <tr key={r.id} className="clickable-row" onClick={() => navigate(`/reports/${r.id}`)}>
                      <td><span className="badge">{r.crime_type}</span></td>
                      <td>{r.resident?.full_name || "Unknown"}</td>
                      <td>{r.location_address || r.latitude?.toFixed(4) + ", " + r.longitude?.toFixed(4)}</td>
                      <td>
                        <span className={`badge badge-${r.status === "resolved" ? "resolved" : r.status === "in-progress" ? "in-progress" : r.status === "needs-backup" ? "needs-backup" : "pending"}`}>
                          {r.status}
                        </span>
                      </td>
                      <td>{new Date(r.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <button className="btn-ghost" disabled={page === 1} onClick={() => setPage(page - 1)}>
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => (
                  <button key={i + 1} className={page === i + 1 ? "btn-primary" : "btn-ghost"} onClick={() => setPage(i + 1)}>
                    {i + 1}
                  </button>
                ))}
                <button className="btn-ghost" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
