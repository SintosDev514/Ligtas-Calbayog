import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { ClipboardList, ChevronLeft, ChevronRight, User, FileText, AlertTriangle, CheckCircle } from "lucide-react";

const ITEMS_PER_PAGE = 20;

export default function AuditLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const channel = supabase
      .channel("admin-audit-logs")
      .on("postgres_changes", { event: "*", schema: "public", table: "crime_reports" }, (payload) => {
        const action = payload.eventType === "INSERT" ? "Created" : payload.eventType === "UPDATE" ? "Updated" : "Deleted";
        setLogs((prev) => [{
          id: `log-${Date.now()}`,
          action,
          table: "crime_reports",
          description: `${action} incident report`,
          timestamp: new Date().toISOString(),
        }, ...prev]);
      })
      .subscribe();
    load();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const load = async () => {
    setLoading(true);
    const items: any[] = [];

    const { data: reports } = await supabase.from("crime_reports").select("id, crime_type, updated_at, created_at").order("updated_at", { ascending: false }).limit(50);
    for (const r of reports || []) {
      items.push({ id: `report-${r.id}`, action: "Created", table: "crime_reports", description: `${r.crime_type} report filed`, actor: "Resident", timestamp: r.created_at });
      items.push({ id: `update-${r.id}`, action: "Updated", table: "crime_reports", description: `${r.crime_type} report updated`, actor: "System", timestamp: r.updated_at });
    }

    const { data: actions } = await supabase.from("action_updates").select("id, action_type, created_at").order("created_at", { ascending: false }).limit(50);
    for (const a of actions || []) {
      items.push({ id: `action-${a.id}`, action: a.action_type || "Action", table: "action_updates", description: `Officer action: ${a.action_type || "Update"}`, actor: "Officer", timestamp: a.created_at });
    }

    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setLogs(items);
    setLoading(false);
  };

  const totalPages = Math.ceil(logs.length / ITEMS_PER_PAGE);
  const paginated = logs.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const getIcon = (action: string) => {
    switch (action) {
      case "Created": return <FileText size={14} />;
      case "Updated": return <AlertTriangle size={14} />;
      case "in-progress": return <ClipboardList size={14} />;
      case "resolved": return <CheckCircle size={14} />;
      default: return <ClipboardList size={14} />;
    }
  };

  const getColor = (action: string) => {
    switch (action) {
      case "Created": return "var(--blue)";
      case "Updated": return "var(--gold)";
      case "resolved": return "var(--green)";
      default: return "var(--gray-500)";
    }
  };

  if (loading) return <div className="page-body"><div className="spinner" /></div>;

  return (
    <>
      <div className="page-header">
        <h2><ClipboardList size={22} /> Audit Logs</h2>
        <span className="badge">{logs.length} entries</span>
      </div>
      <div className="page-body">
        {paginated.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><ClipboardList size={40} /></div>
            <h3>No audit logs</h3>
            <p>System activity will be logged here.</p>
          </div>
        ) : (
          <>
            <div className="card" style={{ padding: 0 }}>
              {paginated.map((log, i) => (
                <div key={log.id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 20px",
                  borderBottom: i < paginated.length - 1 ? "1px solid var(--gray-100)" : "none"
                }}>
                  <div className="stat-icon" style={{ width: 32, height: 32, background: `${getColor(log.action)}15`, color: getColor(log.action) }}>
                    {getIcon(log.action)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{log.description}</div>
                    <div style={{ fontSize: 12, color: "var(--gray-400)", marginTop: 1 }}>
                      {log.table} · {log.actor || "System"} · {new Date(log.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <span className="badge" style={{ fontSize: 11 }}>{log.action}</span>
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
