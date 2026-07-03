import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { Clock, TrendingDown, AlertTriangle, CheckCircle, Timer } from "lucide-react";

export default function ResponseTime() {
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const channel = supabase
      .channel("admin-response-time")
      .on("postgres_changes", { event: "*", schema: "public", table: "crime_reports" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "action_updates" }, () => load())
      .subscribe();
    load();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const load = async () => {
    const { data: reports } = await supabase
      .from("crime_reports")
      .select("id, created_at, status");
    const { data: actions } = await supabase
      .from("action_updates")
      .select("report_id, created_at")
      .order("created_at", { ascending: true });

    if (reports && actions) {
      const firstAction: Record<string, string> = {};
      for (const a of actions) {
        if (!firstAction[a.report_id]) firstAction[a.report_id] = a.created_at;
      }

      const times: number[] = [];
      let responded = 0;
      for (const r of reports) {
        const fa = firstAction[r.id];
        if (fa) {
          responded++;
          const diff = new Date(fa).getTime() - new Date(r.created_at).getTime();
          if (diff > 0) times.push(diff);
        }
      }

      const avg = times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length / 60000) : 0;
      const fastest = times.length > 0 ? Math.round(Math.min(...times) / 60000) : 0;
      const slowest = times.length > 0 ? Math.round(Math.max(...times) / 60000) : 0;

      const buckets = { under15: 0, under60: 0, under120: 0, over120: 0 };
      for (const t of times) {
        const mins = t / 60000;
        if (mins <= 15) buckets.under15++;
        else if (mins <= 60) buckets.under60++;
        else if (mins <= 120) buckets.over120;
        else buckets.over120++;
      }

      setStats({
        avg,
        fastest,
        slowest,
        total: reports.length,
        responded,
        responseRate: reports.length > 0 ? Math.round((responded / reports.length) * 100) : 0,
        buckets,
      });
    }
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

  return (
    <>
      <div className="page-header">
        <h2><Timer size={22} /> Response Time</h2>
      </div>
      <div className="page-body">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "rgba(244,181,26,0.12)", color: "var(--gold)" }}>
              <Clock size={20} />
            </div>
            <div>
              <div className="stat-label">Average Response</div>
              <div className="stat-value">{stats.avg}m</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "rgba(16,185,129,0.12)", color: "var(--green)" }}>
              <TrendingDown size={20} />
            </div>
            <div>
              <div className="stat-label">Fastest</div>
              <div className="stat-value">{stats.fastest}m</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "rgba(239,68,68,0.12)", color: "var(--red)" }}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <div className="stat-label">Slowest</div>
              <div className="stat-value">{stats.slowest}m</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "rgba(99,102,241,0.12)", color: "#6366f1" }}>
              <CheckCircle size={20} />
            </div>
            <div>
              <div className="stat-label">Response Rate</div>
              <div className="stat-value">{stats.responseRate}%</div>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header"><h3>Response Time Distribution</h3></div>
          <div className="card-body">
            {[
              { label: "Under 15 min", count: stats.buckets?.under15 || 0, color: "var(--green)" },
              { label: "15-60 min", count: stats.buckets?.under60 || 0, color: "var(--gold)" },
              { label: "60-120 min", count: stats.buckets?.under120 || 0, color: "var(--orange)" },
              { label: "Over 120 min", count: stats.buckets?.over120 || 0, color: "var(--red)" },
            ].map((b) => {
              const max = Math.max(stats.buckets?.under15 || 1, stats.buckets?.under60 || 1, stats.buckets?.under120 || 1, stats.buckets?.over120 || 1);
              return (
                <div key={b.label} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                    <span>{b.label}</span>
                    <span style={{ fontWeight: 600 }}>{b.count} incidents</span>
                  </div>
                  <div style={{ height: 10, background: "var(--gray-100)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: `${(b.count / max) * 100}%`, height: "100%", background: b.color, borderRadius: 4 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
