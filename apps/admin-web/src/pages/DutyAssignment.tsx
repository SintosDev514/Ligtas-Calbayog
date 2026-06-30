import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { useNavigate } from "react-router-dom";
import { ClipboardList, Users, FileText, MapPin, ChevronLeft, ChevronRight } from "lucide-react";

const ITEMS_PER_PAGE = 15;

export default function DutyAssignment() {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const channel = supabase
      .channel("admin-duty-assignment")
      .on("postgres_changes", { event: "*", schema: "public", table: "action_updates" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "crime_reports" }, () => load())
      .subscribe();
    load();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const load = async () => {
    setLoading(true);
    const { data: updates } = await supabase
      .from("action_updates")
      .select("*, report:crime_reports!report_id(crime_type, status, location_address), officer:police_profiles!officer_id(full_name, badge_id, rank)")
      .order("created_at", { ascending: false });

    if (updates) {
      const active = updates.filter((u: any) => u.report?.status !== "resolved");
      setAssignments(active);
    }
    setLoading(false);
  };

  const totalPages = Math.ceil(assignments.length / ITEMS_PER_PAGE);
  const paginated = assignments.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  if (loading) return <div className="page-body"><div className="spinner" /></div>;

  return (
    <>
      <div className="page-header">
        <h2><ClipboardList size={22} /> Duty Assignment</h2>
        <span className="badge">{assignments.length} active duties</span>
      </div>
      <div className="page-body">
        {paginated.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><ClipboardList size={40} /></div>
            <h3>No active duty assignments</h3>
            <p>Officer assignments to incidents will appear here.</p>
          </div>
        ) : (
          <>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Officer</th>
                    <th>Incident</th>
                    <th>Action</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Assigned</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((a: any) => (
                    <tr key={a.id} className="clickable-row" onClick={() => navigate(`/reports/${a.report_id}`)}>
                      <td style={{ fontWeight: 500 }}>{a.officer?.full_name || "Unknown"}</td>
                      <td><span className="badge">{a.report?.crime_type || "—"}</span></td>
                      <td>{a.action_type || "Update"}</td>
                      <td><MapPin size={12} /> {a.report?.location_address || "—"}</td>
                      <td>
                        <span className={`badge badge-${a.report?.status === "resolved" ? "resolved" : "in-progress"}`}>
                          {a.report?.status || "—"}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, color: "var(--gray-500)" }}>
                        {new Date(a.created_at).toLocaleDateString()}
                      </td>
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
