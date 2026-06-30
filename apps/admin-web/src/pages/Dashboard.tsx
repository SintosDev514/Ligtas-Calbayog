import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import type { DashboardStats } from "../types";

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
        <div className="spinner" />
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
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "#EFF6FF", color: "#1D4ED8" }}>📋</div>
            <div className="stat-label">Total Reports</div>
            <div className="stat-value">{stats?.totalReports ?? 0}</div>
          </div>
          <div className="stat-card" onClick={() => navigate("/reports")} style={{ cursor: "pointer" }}>
            <div className="stat-icon" style={{ background: "#FEF3C7", color: "#D97706" }}>⏳</div>
            <div className="stat-label">Pending Reports</div>
            <div className="stat-value">{stats?.pendingReports ?? 0}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "#DBEAFE", color: "#2563EB" }}>🚨</div>
            <div className="stat-label">Active Officers</div>
            <div className="stat-value">{stats?.totalOfficers ?? 0}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "#D1FAE5", color: "#059669" }}>✅</div>
            <div className="stat-label">Resolved Reports</div>
            <div className="stat-value">{stats?.resolvedReports ?? 0}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "#F5F3FF", color: "#7C3AED" }}>👥</div>
            <div className="stat-label">Total Residents</div>
            <div className="stat-value">{stats?.totalResidents ?? 0}</div>
          </div>
          <div className="stat-card" onClick={() => navigate("/announcements")} style={{ cursor: "pointer" }}>
            <div className="stat-icon" style={{ background: "#ECFDF5", color: "#059669" }}>📢</div>
            <div className="stat-label">Announcements</div>
            <div className="stat-value">{stats?.totalAnnouncements ?? 0}</div>
          </div>
        </div>

        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>Recent Reports</h3>
            <button className="btn btn-sm btn-outline" onClick={() => navigate("/reports")}>
              View All
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
                    <tr key={r.id} onClick={() => navigate(`/reports/${r.id}`)} style={{ cursor: "pointer" }}>
                      <td style={{ textTransform: "capitalize" }}>{r.crime_type?.replace(/-/g, " ")}</td>
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
              <div className="icon">📋</div>
              <h3>No Reports Yet</h3>
              <p>Reports from residents will appear here</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
