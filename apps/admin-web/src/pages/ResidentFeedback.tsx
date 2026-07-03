import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { MessageSquare, ChevronLeft, ChevronRight, Star, ThumbsUp } from "lucide-react";

const ITEMS_PER_PAGE = 15;

export default function ResidentFeedback() {
  const [feedback, setFeedback] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const channel = supabase
      .channel("admin-feedback")
      .on("postgres_changes", { event: "*", schema: "public", table: "report_feedback" }, () => load())
      .subscribe();
    load();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("report_feedback")
      .select("*, resident:resident_profiles!resident_id(full_name), report:crime_reports!report_id(crime_type, status)")
      .order("created_at", { ascending: false });
    if (data) setFeedback(data);
    setLoading(false);
  };

  const totalPages = Math.ceil(feedback.length / ITEMS_PER_PAGE);
  const paginated = feedback.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  if (loading) return <div className="page-body"><div aria-label="Loading..." role="status" className="loader">
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
</div></div>;

  return (
    <>
      <div className="page-header">
        <h2><MessageSquare size={22} /> Resident Feedback</h2>
        <span className="badge">{feedback.length} feedback</span>
      </div>
      <div className="page-body">
        {paginated.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><MessageSquare size={40} /></div>
            <h3>No feedback yet</h3>
            <p>Resident feedback on resolved incidents will appear here.</p>
          </div>
        ) : (
          <>
            <div className="card" style={{ padding: 0 }}>
              {paginated.map((f, i) => (
                <div key={f.id} style={{
                  padding: "16px 20px",
                  borderBottom: i < paginated.length - 1 ? "1px solid var(--gray-100)" : "none"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <strong style={{ fontSize: 14 }}>{f.resident?.full_name || "Anonymous"}</strong>
                    <span style={{ fontSize: 12, color: "var(--gray-400)" }}>
                      {new Date(f.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--gray-600)", marginBottom: 8 }}>
                    {f.message || f.content || "No message content"}
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span className="badge">{f.report?.crime_type || "Report"}</span>
                    <span className={`badge badge-${f.report?.status === "resolved" ? "resolved" : "in-progress"}`}>
                      {f.report?.status || "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="pagination" style={{ marginTop: 16 }}>
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
