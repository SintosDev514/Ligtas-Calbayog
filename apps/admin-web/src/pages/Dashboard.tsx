import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import type { DashboardStats } from "../types";
import { FileText, Clock, Shield, CheckCircle, Users, Megaphone, ArrowRight } from "lucide-react";

const statConfig = [
  { key: "totalReports", label: "Total Reports", icon: FileText, color: "#60A5FA", bg: "rgba(37,107,235,0.15)", link: "/reports" },
  { key: "pendingReports", label: "Pending Reports", icon: Clock, color: "#FBBF24", bg: "rgba(245,158,11,0.15)", link: "/reports" },
  { key: "totalOfficers", label: "Active Officers", icon: Shield, color: "#60A5FA", bg: "rgba(37,107,235,0.15)", link: null },
  { key: "resolvedReports", label: "Resolved Reports", icon: CheckCircle, color: "#34D399", bg: "rgba(16,185,129,0.15)", link: null },
  { key: "totalResidents", label: "Total Residents", icon: Users, color: "#A78BFA", bg: "rgba(139,92,246,0.15)", link: null },
  { key: "totalAnnouncements", label: "Announcements", icon: Megaphone, color: "#34D399", bg: "rgba(16,185,129,0.15)", link: "/announcements" },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentReports, setRecentReports] = useState<any[]>([]);

  useEffect(() => {
    loadData();
    const channel = supabase
      .channel("admin-dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "crime_reports" },
        () => loadData()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadData = async () => {
    try {
      const [
        { count: totalReports },
        { count: pendingReports },
        { count: inProgressReports },
        { count: resolvedReports },
        { count: totalOfficers },
        { count: totalAnnouncements },
        { count: totalResidents },
      ] = await Promise.all([
        supabase.from("crime_reports").select("*", { count: "exact", head: true }),
        supabase.from("crime_reports").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("crime_reports").select("*", { count: "exact", head: true }).eq("status", "in-progress"),
        supabase.from("crime_reports").select("*", { count: "exact", head: true }).eq("status", "resolved"),
        supabase.from("police_profiles").select("*", { count: "exact", head: true }),
        supabase.from("announcements").select("*", { count: "exact", head: true }),
        supabase.from("resident_profiles").select("*", { count: "exact", head: true }),
      ]);

      setStats({
        totalReports: totalReports ?? 0,
        pendingReports: pendingReports ?? 0,
        resolvedReports: resolvedReports ?? 0,
        totalOfficers: totalOfficers ?? 0,
        totalAnnouncements: totalAnnouncements ?? 0,
        totalResidents: totalResidents ?? 0,
      });

      const { data: reports } = await supabase
        .from("crime_reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);

      const withResidents = await Promise.all(
        (reports ?? []).map(async (r: any) => {
          const { data: rp } = await supabase
            .from("resident_profiles")
            .select("full_name")
            .eq("id", r.resident_id)
            .maybeSingle();
          return { ...r, resident: rp || null };
        })
      );
      setRecentReports(withResidents);
    } catch (err) {
      console.error("Failed to load stats:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (loading) {
    return (
      <div className="page-body" style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
        <div className="honeycomb"><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h2>Dashboard</h2>
        <span style={{ fontSize: 13, color: "var(--gray-400)" }}>
          {new Date().toLocaleDateString("en-PH", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </div>
      <div className="page-body">
        <div className="stats-grid">
          {statConfig.map((cfg) => {
            const value = stats ? (stats as any)[cfg.key] ?? 0 : 0;
            const Icon = cfg.icon;
            return (
              <div
                key={cfg.key}
                className={`stat-card${cfg.link ? " clickable" : ""}`}
                onClick={cfg.link ? () => navigate(cfg.link) : undefined}
              >
                <div className="stat-icon" style={{ background: cfg.bg, color: cfg.color }}>
                  <Icon size={20} />
                </div>
                <div className="stat-label">{cfg.label}</div>
                <div className="stat-value">{value}</div>
              </div>
            );
          })}
        </div>

        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>Recent Reports</h3>
            <button className="btn btn-sm btn-outline" onClick={() => navigate("/reports")}>
              View All <ArrowRight size={14} />
            </button>
          </div>
          {recentReports.length > 0 ? (
            <div className="table-container" style={{ border: "none", borderRadius: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Resident</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentReports.map((r) => (
                    <tr key={r.id} className="clickable-row" onClick={() => navigate(`/reports/${r.id}`)}>
                      <td style={{ textTransform: "capitalize", fontWeight: 600 }}>
                        {r.crime_type?.replace(/-/g, " ")}
                      </td>
                      <td>{r.resident?.full_name || "Unknown"}</td>
                      <td>
                        <span className={`badge badge-${r.status}`}>{r.status}</span>
                      </td>
                      <td style={{ color: "var(--gray-400)", fontSize: 13 }}>{formatDate(r.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon"><FileText size={24} /></div>
              <h3>No Reports Yet</h3>
              <p>Reports from residents will appear here</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
