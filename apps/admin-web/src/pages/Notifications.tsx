import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { Bell, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle, Info, Megaphone } from "lucide-react";

const ITEMS_PER_PAGE = 20;

export default function Notifications() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const channel = supabase
      .channel("admin-notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "crime_reports" }, (payload) => {
        setNotifications((prev) => [{ ...payload.new, type: "crime_report" }, ...prev]);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "report_feedback" }, (payload) => {
        setNotifications((prev) => [{ ...payload.new, type: "feedback" }, ...prev]);
      })
      .subscribe();
    load();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const load = async () => {
    setLoading(true);
    const { data: reports } = await supabase.from("crime_reports").select("id, crime_type, created_at").order("created_at", { ascending: false }).limit(50);
    const { data: feedback } = await supabase.from("report_feedback").select("id, created_at").order("created_at", { ascending: false }).limit(50);

    const items: any[] = [
      ...(reports || []).map((r: any) => ({ id: `report-${r.id}`, type: "crime_report", message: `New ${r.crime_type} report filed`, time: r.created_at })),
      ...(feedback || []).map((f: any) => ({ id: `feedback-${f.id}`, type: "feedback", message: "New feedback received", time: f.created_at })),
    ];
    items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    setNotifications(items);
    setLoading(false);
  };

  const totalPages = Math.ceil(notifications.length / ITEMS_PER_PAGE);
  const paginated = notifications.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const getIcon = (type: string) => {
    switch (type) {
      case "crime_report": return <AlertTriangle size={16} />;
      case "feedback": return <Info size={16} />;
      default: return <Bell size={16} />;
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case "crime_report": return "var(--red)";
      case "feedback": return "var(--blue)";
      default: return "var(--gray-500)";
    }
  };

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
        <h2><Bell size={22} /> Notifications</h2>
        <span className="badge">{notifications.length} notifications</span>
      </div>
      <div className="page-body">
        {paginated.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><Bell size={40} /></div>
            <h3>No notifications</h3>
            <p>New reports and feedback will appear here in real time.</p>
          </div>
        ) : (
          <>
            <div className="card" style={{ padding: 0 }}>
              {paginated.map((n, i) => (
                <div key={n.id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "14px 20px",
                  borderBottom: i < paginated.length - 1 ? "1px solid var(--gray-100)" : "none"
                }}>
                  <div className="stat-icon" style={{ width: 34, height: 34, background: `${getColor(n.type)}15`, color: getColor(n.type) }}>
                    {getIcon(n.type)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{n.message}</div>
                    <div style={{ fontSize: 12, color: "var(--gray-400)", marginTop: 2 }}>
                      {new Date(n.time).toLocaleString()}
                    </div>
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
