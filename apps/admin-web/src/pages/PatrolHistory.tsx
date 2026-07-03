import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { History, Navigation, ChevronLeft, ChevronRight, Clock } from "lucide-react";

const ITEMS_PER_PAGE = 20;

export default function PatrolHistory() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data: locations } = await supabase
      .from("police_locations")
      .select("*, officer:police_profiles!officer_id(full_name, badge_id, rank)")
      .order("updated_at", { ascending: false })
      .limit(100);

    if (locations) {
      const { data: updates } = await supabase
        .from("action_updates")
        .select("*, officer:police_profiles!officer_id(full_name, badge_id, rank)")
        .order("created_at", { ascending: false })
        .limit(100);

      const combined = [
        ...(locations || []).map((l: any) => ({
          id: l.id,
          type: "location",
          officer_name: l.officer?.full_name || "Unknown",
          officer_badge: l.officer?.badge_id || "",
          officer_rank: l.officer?.rank || "",
          description: `Location update at ${l.latitude?.toFixed(4)}, ${l.longitude?.toFixed(4)}`,
          timestamp: l.updated_at,
        })),
        ...(updates || []).map((u: any) => ({
          id: u.id,
          type: "action",
          officer_name: u.officer?.full_name || "Unknown",
          officer_badge: u.officer?.badge_id || "",
          officer_rank: u.officer?.rank || "",
          description: u.description || u.action_type || "Action taken",
          timestamp: u.created_at,
        })),
      ];

      combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setHistory(combined);
    }
    setLoading(false);
  };

  const totalPages = Math.ceil(history.length / ITEMS_PER_PAGE);
  const paginated = history.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

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
        <h2><History size={22} /> Patrol History</h2>
        <span className="badge">{history.length} events</span>
      </div>
      <div className="page-body">
        {paginated.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><History size={40} /></div>
            <h3>No patrol history</h3>
            <p>Patrol activity logs will appear here.</p>
          </div>
        ) : (
          <>
            <div className="card">
              <div className="card-body" style={{ padding: 0 }}>
                {paginated.map((entry, i) => (
                  <div key={entry.id} style={{
                    display: "flex", alignItems: "flex-start", gap: 14,
                    padding: "14px 20px",
                    borderBottom: i < paginated.length - 1 ? "1px solid var(--gray-100)" : "none"
                  }}>
                    <div className="stat-icon" style={{
                      width: 36, height: 36, flexShrink: 0,
                      background: entry.type === "location"
                        ? "rgba(37,99,235,0.1)" : "rgba(244,181,26,0.1)",
                      color: entry.type === "location" ? "var(--blue)" : "var(--gold)"
                    }}>
                      {entry.type === "location" ? <Navigation size={16} /> : <Clock size={16} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                        <strong style={{ fontSize: 14 }}>{entry.officer_name}</strong>
                        <span style={{ fontSize: 12, color: "var(--gray-400)" }}>
                          {new Date(entry.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: "var(--gray-500)" }}>
                        {entry.officer_rank} — {entry.officer_badge}
                      </div>
                      <div style={{ fontSize: 13, color: "var(--gray-600)", marginTop: 2 }}>
                        {entry.description}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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
