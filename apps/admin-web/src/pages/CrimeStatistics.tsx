import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { BarChart3, FileText, CheckCircle, AlertTriangle, Clock, TrendingUp } from "lucide-react";

export default function CrimeStatistics() {
  const [stats, setStats] = useState<any>({});
  const [byType, setByType] = useState<any[]>([]);
  const [byMonth, setByMonth] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const channel = supabase
      .channel("admin-crime-stats")
      .on("postgres_changes", { event: "*", schema: "public", table: "crime_reports" }, () => load())
      .subscribe();
    load();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const load = async () => {
    const { data } = await supabase.from("crime_reports").select("*");
    if (data) {
      const typeMap: Record<string, number> = {};
      const monthMap: Record<string, number> = {};
      let total = data.length;
      let resolved = 0;
      let pending = 0;
      let inProgress = 0;

      for (const r of data) {
        const t = r.crime_type || "Other";
        typeMap[t] = (typeMap[t] || 0) + 1;

        const m = new Date(r.created_at).toLocaleString("default", { month: "short", year: "2-digit" });
        monthMap[m] = (monthMap[m] || 0) + 1;

        if (r.status === "resolved") resolved++;
        else if (r.status === "pending") pending++;
        else inProgress++;
      }

      setByType(Object.entries(typeMap).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count));
      setByMonth(Object.entries(monthMap).map(([month, count]) => ({ month, count })).sort((a, b) => {
        const da = new Date(a.month);
        const db = new Date(b.month);
        return da.getTime() - db.getTime();
      }));
      setStats({ total, resolved, pending, inProgress });
    }
    setLoading(false);
  };

  if (loading) return <div className="page-body"><div className="spinner" /></div>;

  const resolveRate = stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0;
  const maxType = byType.length > 0 ? Math.max(...byType.map((t) => t.count)) : 1;
  const maxMonth = byMonth.length > 0 ? Math.max(...byMonth.map((m) => m.count)) : 1;

  return (
    <>
      <div className="page-header">
        <h2><BarChart3 size={22} /> Crime Statistics</h2>
      </div>
      <div className="page-body">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "rgba(244,181,26,0.12)", color: "var(--gold)" }}>
              <FileText size={20} />
            </div>
            <div>
              <div className="stat-label">Total Reports</div>
              <div className="stat-value">{stats.total}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "rgba(16,185,129,0.12)", color: "var(--green)" }}>
              <CheckCircle size={20} />
            </div>
            <div>
              <div className="stat-label">Resolved</div>
              <div className="stat-value">{stats.resolved}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "rgba(239,68,68,0.12)", color: "var(--red)" }}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <div className="stat-label">Pending</div>
              <div className="stat-value">{stats.pending}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "rgba(99,102,241,0.12)", color: "#6366f1" }}>
              <TrendingUp size={20} />
            </div>
            <div>
              <div className="stat-label">Resolve Rate</div>
              <div className="stat-value">{resolveRate}%</div>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 20 }}>
          <div className="card">
            <div className="card-header"><h3>By Crime Type</h3></div>
            <div className="card-body">
              {byType.map((t) => (
                <div key={t.type} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                    <span>{t.type}</span>
                    <span style={{ fontWeight: 600 }}>{t.count}</span>
                  </div>
                  <div style={{ height: 8, background: "var(--gray-100)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: `${(t.count / maxType) * 100}%`, height: "100%", background: "var(--gold)", borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h3>Monthly Trend</h3></div>
            <div className="card-body">
              {byMonth.map((m) => (
                <div key={m.month} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                    <span>{m.month}</span>
                    <span style={{ fontWeight: 600 }}>{m.count}</span>
                  </div>
                  <div style={{ height: 8, background: "var(--gray-100)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: `${(m.count / maxMonth) * 100}%`, height: "100%", background: "var(--blue)", borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
