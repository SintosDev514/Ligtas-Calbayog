import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard, FileText, AlertTriangle, CheckCircle,
  MapPin, Shield, History, Calendar,
  Users, ClipboardList, TrendingUp,
  BarChart3, Map, Timer,
  Megaphone, MessageSquare,
  FolderOpen, MapPin as MapPinIcon, Bell,
  UserCog, ShieldCheck, ClipboardList as AuditIcon, Settings,
  LogOut, ChevronLeft, ExternalLink, X
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";

const navGroups = [
  {
    label: null,
    items: [
      { path: "/", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "OPERATIONS",
    items: [
      { path: "/police-tracking", label: "Operations Map", icon: MapPin },
      { path: "/patrol-units", label: "Patrol Units", icon: Shield },
      { path: "/patrol-history", label: "Patrol History", icon: History },
      { path: "/shift-schedule", label: "Shift Schedule", icon: Calendar },
    ],
  },
  {
    label: "INCIDENTS",
    items: [
      { path: "/reports", label: "Reports", icon: FileText },
      { path: "/active-incidents", label: "Active Incidents", icon: AlertTriangle },
      { path: "/resolved-cases", label: "Resolved Cases", icon: CheckCircle },
      { path: "/crime-statistics", label: "Crime Statistics", icon: BarChart3 },
      { path: "/crime-heatmap", label: "Crime Heatmap", icon: Map },
      { path: "/response-time", label: "Response Time", icon: Timer },
    ],
  },
  {
    label: "PERSONNEL",
    items: [
      { path: "/police-officers", label: "Police Officers", icon: Users },
      { path: "/duty-assignment", label: "Duty Assignment", icon: ClipboardList },
      { path: "/performance", label: "Performance", icon: TrendingUp },
    ],
  },
  {
    label: "COMMUNITY",
    items: [
      { path: "/announcements", label: "Announcements", icon: Megaphone },
      { path: "/resident-feedback", label: "Resident Feedback", icon: MessageSquare },
    ],
  },
  {
    label: "MANAGEMENT",
    items: [
      { path: "/evidence", label: "Evidence", icon: FolderOpen },
      { path: "/barangays", label: "Barangays", icon: MapPinIcon },
      { path: "/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    label: "SYSTEM",
    items: [
      { path: "/users", label: "Users", icon: UserCog },
      { path: "/roles", label: "Roles", icon: ShieldCheck },
      { path: "/audit-logs", label: "Audit Logs", icon: AuditIcon },
      { path: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export default function Layout() {
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [newReport, setNewReport] = useState<any>(null);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const channel = supabase
      .channel("global-new-reports")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "crime_reports" },
        (payload: any) => {
          const report = payload.new;
          setNewReport(report);
          setVisible(true);
          clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => setVisible(false), 6000);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      clearTimeout(timerRef.current);
    };
  }, []);

  const handleView = () => {
    setVisible(false);
    if (newReport?.id) navigate(`/reports/${newReport.id}`);
  };

  const handleDismiss = () => setVisible(false);

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="layout">
      {visible && newReport && (
        <>
          <div
            onClick={handleDismiss}
            style={{
              position: "fixed", inset: 0, zIndex: 9998,
              background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
              animation: "fadeIn 0.25s ease-out",
            }}
          />
          <div
            style={{
              position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
              zIndex: 9999, width: 400, maxWidth: "90vw",
              background: "var(--gray-100)", borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
              animation: "alertSlideIn 0.35s cubic-bezier(0.16,1,0.3,1)",
              overflow: "hidden",
            }}
          >
            <div style={{
              background: "linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.05))",
              padding: "20px 24px 16px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              display: "flex", alignItems: "flex-start", gap: 12,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: "rgba(239,68,68,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <AlertTriangle size={20} color="#ef4444" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--gray-900)", marginBottom: 2 }}>
                  New Report Alert
                </div>
                <div style={{ fontSize: 12, color: "var(--gray-500)", lineHeight: 1.4 }}>
                  A new incident has been reported
                  {newReport.crime_type && (
                    <> — <span style={{ textTransform: "capitalize", color: "var(--gray-400)", fontWeight: 600 }}>{newReport.crime_type.replace(/-/g, " ")}</span></>
                  )}
                </div>
              </div>
              <button onClick={handleDismiss}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--gray-500)", padding: 2, lineHeight: 0,
                }}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: "12px 24px 16px", display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={handleDismiss}
                style={{
                  padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                  background: "transparent", color: "var(--gray-500)",
                  border: "1px solid var(--gray-300)", borderRadius: 6,
                }}
              >
                Dismiss
              </button>
              <button
                onClick={handleView}
                style={{
                  padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                  background: "#ef4444", color: "#fff",
                  border: "none", borderRadius: 6,
                  display: "flex", alignItems: "center", gap: 5,
                }}
              >
                View Report <ExternalLink size={12} />
              </button>
            </div>
          </div>
        </>
      )}

      <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <img src="/logo-police.png" alt="PNP" style={{ width: 48, height: 48, objectFit: "contain" }} />
          </div>
          <div className="sidebar-brand-text">
            <h1>PNP Admin</h1>
            <p>Ligtas Calbayog</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navGroups.map((group, gi) => (
            <div className="nav-group" key={gi}>
              {group.label && (
                <div className="nav-section-header">{group.label}</div>
              )}
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === "/"}
                  className={({ isActive }) =>
                    `nav-item${isActive ? " active" : ""}`
                  }
                >
                  <span className="nav-icon">
                    <item.icon size={18} />
                  </span>
                  <span className="nav-label">{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <button
          className="sidebar-toggle"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronLeft size={14} />
        </button>

        <div className="sidebar-footer">
          <div className="sidebar-footer-text">
            {profile?.email || "Admin"}
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            <LogOut size={18} />
            <span className="nav-label">Logout</span>
          </button>
        </div>
      </aside>
      <main className={`main-content${collapsed ? " sidebar-collapsed" : ""}`}>
        <Outlet />
      </main>
    </div>
  );
}
