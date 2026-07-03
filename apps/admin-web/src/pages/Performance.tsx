import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { TrendingUp, FileText, Users, CheckCircle, Clock, AlertTriangle, Shield } from "lucide-react";

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

  const resolveRate = stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0;

  return (
    <>
      <div className="page-header">
        <h2><TrendingUp size={22} /> Performance</h2>
      </div>
      <div className="page-body">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "rgba(244,181,26,0.12)", color: "var(--gold)" }}>
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
              <div className="stat-label">Active</div>
              <div className="stat-value">{stats.active || 0}</div>
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
              <Shield size={20} />
            </div>
            <div>
              <div className="stat-label">Total Actions</div>
              <div className="stat-value">{stats.actions || 0}</div>
            </div>
          </div>
        </div>

        {officerStats.length > 0 && (
          <div className="card" style={{ marginTop: 20 }}>
            <div className="card-header">
              <h3>Officer Activity Ranking</h3>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <div className="table-container" style={{ border: "none" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Officer</th>
                      <th>Badge</th>
                      <th>Actions Taken</th>
                    </tr>
                  </thead>
                  <tbody>
                    {officerStats.map((o: any, i: number) => (
                      <tr key={o.id}>
                        <td><span className="badge">#{i + 1}</span></td>
                        <td style={{ fontWeight: 500 }}>{o.name}</td>
                        <td style={{ color: "var(--gray-500)" }}>{o.badge}</td>
                        <td><span className="badge">{o.actions}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
