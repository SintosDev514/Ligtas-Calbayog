import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { BarChart3, FileText, CheckCircle, AlertTriangle, Clock, TrendingUp, PieChart, Activity, ArrowUpRight } from "lucide-react";

const TYPE_COLORS = ["#60a5fa", "#f59e0b", "#ef4444", "#10b981", "#a78bfa", "#f97316", "#ec4899", "#06b6d4", "#84cc16", "#e879f9"];

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

  if (loading) return <div className="page-body"><div aria-label="Loading..." role="status" className="loader">
  <svg className="icon" viewBox="0 0 256 256">
    <line x1="128" y1="32" x2="128" y2="64" strokeLinecap="round" strokeLinejoin="round" strokeWidth="24"></line>
    <line x1="195.9" y1="60.1" x2="173.3" y2="82.7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="24"></line>
    <line x1="224" y1="128" x2="192" y2="128" strokeLinecap="round" strokeLinejoin="round" strokeWidth="24"></line>
    <line x1="195.9" y1="195.9" x2="173.3" y2="173.3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="24"></line>
    <line x1="128" y1="224" x2="128" y2="192" strokeLinecap="round" strokeLinejoin="round" strokeWidth="24"></line>
    <line x1="60.1" y1="195.9" x2="82.7" y2="173.3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="24"></line>
    <line x1="32" y1="128" x2="64" y2="128" strokeLinecap="round" strokeLinejoin="round" strokeWidth="24"></line>
    <line x1="60.1" y1="60.1" x2="82.7" y2="82.7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="24"></line>
  </svg>
  <span className="loading-text">Loading...</span>
</div></div>;

  const resolveRate = stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0;
  const pendingRate = stats.total > 0 ? Math.round((stats.pending / stats.total) * 100) : 0;
  const inProgressRate = stats.total > 0 ? Math.round((stats.inProgress / stats.total) * 100) : 0;
  const maxType = byType.length > 0 ? Math.max(...byType.map((t) => t.count)) : 1;
  const maxMonth = byMonth.length > 0 ? Math.max(...byMonth.map((m) => m.count)) : 1;

  const totalStatus = (stats.resolved || 0) + (stats.pending || 0) + (stats.inProgress || 0);
  const resolvedDeg = totalStatus > 0 ? (stats.resolved / totalStatus) * 360 : 0;
  const pendingDeg = totalStatus > 0 ? (stats.pending / totalStatus) * 360 : 0;
  const inProgressDeg = totalStatus > 0 ? (stats.inProgress / totalStatus) * 360 : 0;

  return (
    <>
      <div className="page-header">
        <h2><BarChart3 size={22} /> Crime Statistics</h2>
      </div>
      <div className="page-body">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "rgba(96,165,250,0.12)", color: "#60a5fa" }}>
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
            <div className="stat-icon" style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24" }}>
              <Activity size={20} />
            </div>
            <div>
              <div className="stat-label">In Progress</div>
              <div className="stat-value">{stats.inProgress}</div>
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

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 4 }}>
          <div className="card">
            <div className="card-header">
              <h3><PieChart size={16} style={{ marginRight: 8, opacity: 0.6 }} />Status Breakdown</h3>
            </div>
            <div className="card-body" style={{ display: "flex", alignItems: "center", gap: 32 }}>
              <div style={{ position: "relative", width: 160, height: 160, flexShrink: 0 }}>
                <svg viewBox="0 0 36 36" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
                  <circle cx="18" cy="18" r="14" fill="none" stroke="var(--gray-200)" strokeWidth="5" />
                  {resolvedDeg > 0 && (
                    <circle cx="18" cy="18" r="14" fill="none" stroke="#10b981" strokeWidth="5"
                      strokeDasharray={`${resolvedDeg} ${360 - resolvedDeg}`} strokeLinecap="round" />
                  )}
                  {pendingDeg > 0 && (
                    <circle cx="18" cy="18" r="14" fill="none" stroke="#ef4444" strokeWidth="5"
                      strokeDasharray={`${pendingDeg} ${360 - pendingDeg}`}
                      strokeDashoffset={-resolvedDeg} strokeLinecap="round" />
                  )}
                  {inProgressDeg > 0 && (
                    <circle cx="18" cy="18" r="14" fill="none" stroke="#fbbf24" strokeWidth="5"
                      strokeDasharray={`${inProgressDeg} ${360 - inProgressDeg}`}
                      strokeDashoffset={-(resolvedDeg + pendingDeg)} strokeLinecap="round" />
                  )}
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 26, fontWeight: 800, color: "var(--gray-900)", lineHeight: 1 }}>{stats.total}</span>
                  <span style={{ fontSize: 11, color: "var(--gray-400)", marginTop: 2 }}>total</span>
                </div>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
                {[
                  { label: "Resolved", value: stats.resolved, pct: resolveRate, color: "#10b981" },
                  { label: "Pending", value: stats.pending, pct: pendingRate, color: "#ef4444" },
                  { label: "In Progress", value: stats.inProgress, pct: inProgressRate, color: "#fbbf24" },
                ].map((s) => (
                  <div key={s.label}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: "var(--gray-600)", fontWeight: 500 }}>{s.label}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--gray-900)" }}>{s.value}</span>
                        <span style={{ fontSize: 11, color: "var(--gray-400)", fontWeight: 500 }}>{s.pct}%</span>
                      </div>
                    </div>
                    <div style={{ height: 6, background: "var(--gray-200)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ width: `${s.pct}%`, height: "100%", background: s.color, borderRadius: 3, transition: "width 0.6s ease" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3><BarChart3 size={16} style={{ marginRight: 8, opacity: 0.6 }} />Monthly Trend</h3>
            </div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 160, marginBottom: 12 }}>
                {byMonth.slice(-12).map((m, i) => (
                  <div key={m.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--gray-500)", marginBottom: 4 }}>{m.count}</span>
                    <div style={{
                      width: "100%",
                      maxWidth: 40,
                      height: `${(m.count / maxMonth) * 100}%`,
                      minHeight: m.count > 0 ? 4 : 0,
                      background: `linear-gradient(180deg, #60a5fa, #3b82f6)`,
                      borderRadius: "4px 4px 2px 2px",
                      transition: "height 0.5s ease"
                    }} />
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {byMonth.slice(-12).map((m) => (
                  <div key={m.month + "-label"} style={{ flex: 1, textAlign: "center", fontSize: 10, color: "var(--gray-400)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden" }}>
                    {m.month}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header">
            <h3><AlertTriangle size={16} style={{ marginRight: 8, opacity: 0.6 }} />Crime Type Breakdown</h3>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {byType.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: "var(--gray-400)", fontSize: 13 }}>No crime reports yet.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 1 }}>
                  {byType.map((t, i) => {
                    const pct = Math.round((t.count / stats.total) * 100);
                    const color = TYPE_COLORS[i % TYPE_COLORS.length];
                    return (
                      <div key={t.type} style={{
                        display: "flex", alignItems: "center", gap: 14, padding: "14px 20px",
                        borderBottom: "1px solid var(--gray-200)", transition: "background 0.2s"
                      }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 8, background: `${color}18`, color: color,
                          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, flexShrink: 0
                        }}>
                          {i + 1}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.type}</span>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--gray-900)" }}>{t.count}</span>
                              <span style={{ fontSize: 11, color: "var(--gray-400)", fontWeight: 500 }}>{pct}%</span>
                            </div>
                          </div>
                          <div style={{ height: 5, background: "var(--gray-200)", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ width: `${(t.count / maxType) * 100}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.5s ease" }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
