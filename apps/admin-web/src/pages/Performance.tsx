import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { TrendingUp, FileText, Users, CheckCircle, AlertTriangle, Shield, Activity, Target } from "lucide-react";

const RANK_COLORS = ["#f59e0b", "#94a3b8", "#cd7f32", "#60a5fa", "#60a5fa"];

export default function Performance() {
  const [stats, setStats] = useState<any>({});
  const [officerStats, setOfficerStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const channel = supabase
      .channel("admin-performance")
      .on("postgres_changes", { event: "*", schema: "public", table: "crime_reports" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "action_updates" }, () => load())
      .subscribe();
    load();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const load = async () => {
    const { count: total } = await supabase.from("crime_reports").select("*", { count: "exact", head: true });
    const { count: resolved } = await supabase.from("crime_reports").select("*", { count: "exact", head: true }).eq("status", "resolved");
    const { count: active } = await supabase.from("crime_reports").select("*", { count: "exact", head: true }).in("status", ["pending", "in-progress", "needs-backup"]);
    const { count: officers } = await supabase.from("police_profiles").select("*", { count: "exact", head: true });
    const { count: actions } = await supabase.from("action_updates").select("*", { count: "exact", head: true });

    const { data: actionData } = await supabase
      .from("action_updates")
      .select("officer_id, officer:police_profiles!officer_id(full_name, badge_id)");

    const officerMap: Record<string, any> = {};
    for (const a of actionData || []) {
      const id = a.officer_id;
      if (!officerMap[id]) {
        const officer = Array.isArray(a.officer) ? a.officer[0] : a.officer;
        officerMap[id] = {
          id,
          name: officer?.full_name || "Unknown",
          badge: officer?.badge_id || "",
          actions: 0,
        };
      }
      officerMap[id].actions++;
    }

    setStats({ total, resolved, active, officers, actions });
    setOfficerStats(Object.values(officerMap).sort((a: any, b: any) => b.actions - a.actions));
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
  const activeRate = stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0;
  const avgActions = (stats.officers || 0) > 0 ? Math.round(((stats.actions || 0) / stats.officers) * 10) / 10 : 0;
  const maxActions = officerStats.length > 0 ? officerStats[0].actions : 1;

  const resolvedDeg = (stats.resolved || 0) / (stats.total || 1) * 360;
  const activeDeg = (stats.active || 0) / (stats.total || 1) * 360;

  return (
    <>
      <div className="page-header">
        <h2><TrendingUp size={22} /> Performance</h2>
      </div>
      <div className="page-body">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "rgba(96,165,250,0.12)", color: "#60a5fa" }}>
              <FileText size={20} />
            </div>
            <div>
              <div className="stat-label">Total Reports</div>
              <div className="stat-value">{stats.total || 0}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "rgba(16,185,129,0.12)", color: "var(--green)" }}>
              <CheckCircle size={20} />
            </div>
            <div>
              <div className="stat-label">Resolved</div>
              <div className="stat-value">{stats.resolved || 0}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "rgba(239,68,68,0.12)", color: "var(--red)" }}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <div className="stat-label">Active Cases</div>
              <div className="stat-value">{stats.active || 0}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "rgba(37,99,235,0.12)", color: "var(--blue)" }}>
              <Users size={20} />
            </div>
            <div>
              <div className="stat-label">Active Officers</div>
              <div className="stat-value">{stats.officers || 0}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "rgba(139,92,246,0.12)", color: "var(--purple)" }}>
              <Activity size={20} />
            </div>
            <div>
              <div className="stat-label">Total Actions</div>
              <div className="stat-value">{stats.actions || 0}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24" }}>
              <Target size={20} />
            </div>
            <div>
              <div className="stat-label">Avg Actions / Officer</div>
              <div className="stat-value">{avgActions}</div>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 4 }}>
          <div className="card">
            <div className="card-header">
              <h3><Target size={16} style={{ marginRight: 8, opacity: 0.6 }} />Case Resolution</h3>
            </div>
            <div className="card-body" style={{ display: "flex", alignItems: "center", gap: 32 }}>
              <div style={{ position: "relative", width: 160, height: 160, flexShrink: 0 }}>
                <svg viewBox="0 0 36 36" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
                  <circle cx="18" cy="18" r="14" fill="none" stroke="var(--gray-200)" strokeWidth="5" />
                  {resolvedDeg > 0 && (
                    <circle cx="18" cy="18" r="14" fill="none" stroke="#10b981" strokeWidth="5"
                      strokeDasharray={`${resolvedDeg} ${360 - resolvedDeg}`} strokeLinecap="round" />
                  )}
                  {activeDeg > 0 && (
                    <circle cx="18" cy="18" r="14" fill="none" stroke="#ef4444" strokeWidth="5"
                      strokeDasharray={`${activeDeg} ${360 - activeDeg}`}
                      strokeDashoffset={-resolvedDeg} strokeLinecap="round" />
                  )}
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 26, fontWeight: 800, color: "var(--gray-900)", lineHeight: 1 }}>{resolveRate}%</span>
                  <span style={{ fontSize: 11, color: "var(--gray-400)", marginTop: 2 }}>resolved</span>
                </div>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
                {[
                  { label: "Resolved", value: stats.resolved || 0, pct: resolveRate, color: "#10b981" },
                  { label: "Active", value: stats.active || 0, pct: activeRate, color: "#ef4444" },
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
                <div style={{ marginTop: 4, padding: "10px 14px", background: "var(--gray-200)", borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
                  <Activity size={16} style={{ color: "var(--gray-400)" }} />
                  <div>
                    <div style={{ fontSize: 11, color: "var(--gray-400)", fontWeight: 500 }}>Total Actions Logged</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "var(--gray-900)" }}>{stats.actions || 0}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3><Shield size={16} style={{ marginRight: 8, opacity: 0.6 }} />Quick Stats</h3>
            </div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { label: "Total Reports Filed", value: stats.total || 0, icon: FileText, color: "#60a5fa" },
                { label: "Cases Resolved", value: stats.resolved || 0, icon: CheckCircle, color: "#10b981" },
                { label: "Cases Still Active", value: stats.active || 0, icon: AlertTriangle, color: "#ef4444" },
                { label: "Active Officers", value: stats.officers || 0, icon: Users, color: "#a78bfa" },
              ].map((item) => (
                <div key={item.label} style={{
                  display: "flex", alignItems: "center", gap: 14, padding: "12px 16px",
                  background: "var(--gray-200)", borderRadius: 8, transition: "background 0.2s"
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8, background: `${item.color}18`, color: item.color,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
                  }}>
                    <item.icon size={18} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: "var(--gray-400)", fontWeight: 500 }}>{item.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "var(--gray-900)" }}>{item.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {officerStats.length > 0 && (
          <div className="card" style={{ marginTop: 20 }}>
            <div className="card-header">
              <h3><TrendingUp size={16} style={{ marginRight: 8, opacity: 0.6 }} />Officer Activity Ranking</h3>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {officerStats.map((o: any, i: number) => {
                const rankColor = RANK_COLORS[i] || "#60a5fa";
                const barPct = (o.actions / maxActions) * 100;
                return (
                  <div key={o.id} style={{
                    display: "flex", alignItems: "center", gap: 14, padding: "14px 20px",
                    borderBottom: "1px solid var(--gray-200)", transition: "background 0.2s"
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, background: `${rankColor}18`, color: rankColor,
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, flexShrink: 0
                    }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.name}</span>
                          <span style={{ fontSize: 11, color: "var(--gray-400)", fontWeight: 500, flexShrink: 0 }}>{o.badge}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--gray-900)" }}>{o.actions}</span>
                          <span style={{ fontSize: 11, color: "var(--gray-400)", fontWeight: 500 }}>actions</span>
                        </div>
                      </div>
                      <div style={{ height: 5, background: "var(--gray-200)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: `${barPct}%`, height: "100%", background: rankColor, borderRadius: 3, transition: "width 0.5s ease" }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
