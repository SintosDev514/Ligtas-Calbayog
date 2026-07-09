import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useAlarm } from "../context/AlarmContext";
import {
  LayoutDashboard, FileText, AlertTriangle, CheckCircle,
  MapPin, Shield, History,
  Users, ClipboardList, TrendingUp,
  BarChart3, Map, Timer,
  Megaphone, MessageSquare,
  FolderOpen, MapPin as MapPinIcon, Bell,
  UserCog, ShieldCheck, ClipboardList as AuditIcon, Settings,
  LogOut, ChevronLeft, X
} from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
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
  const { refreshAlarm } = useAlarm();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [bannerReport, setBannerReport] = useState<any | null>(null);
  const lastBannerId = useRef<string | null>(null);

  const fetchPendingCount = useCallback(async () => {
    try {
      const { count } = await supabase
        .from("crime_reports")
        .select("id", { count: "exact", head: true })
        .in("status", ["pending", "under-review", "in-progress"]);
      if (count !== null) setPendingCount(count);
    } catch {
      // silent
    }
  }, []);

  const checkNewReport = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("crime_reports")
        .select("id, crime_type, location_address, created_at, status")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data && data.id !== lastBannerId.current) {
        lastBannerId.current = data.id;
        setBannerReport(data);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchPendingCount();
    const countPoll = setInterval(fetchPendingCount, 30000);
    return () => clearInterval(countPoll);
  }, [fetchPendingCount]);

  useEffect(() => {
    checkNewReport();
    const interval = setInterval(checkNewReport, 3000);
    return () => clearInterval(interval);
  }, [checkNewReport]);

  useEffect(() => {
    if (/^\/reports\/[^/]+$/.test(location.pathname)) {
      setBannerReport(null);
    }
  }, [location.pathname]);

  const handleView = () => {
    if (bannerReport?.id) {
      const id = bannerReport.id;
      setBannerReport(null);
      navigate(`/reports/${id}`);
    }
  };

  const handleDismiss = () => {
    setBannerReport(null);
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="layout">
      {bannerReport && (
        <div
          onClick={handleView}
          style={{
            position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
            background: "linear-gradient(135deg, rgba(239,68,68,0.95), rgba(185,28,28,0.95))",
            backdropFilter: "blur(12px)",
            padding: "14px 20px",
            display: "flex", alignItems: "center", gap: 14,
            cursor: "pointer",
            boxShadow: "0 4px 24px rgba(239,68,68,0.4)",
            animation: "bannerSlideDown 0.4s cubic-bezier(0.16,1,0.3,1)",
            userSelect: "none",
          }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: "rgba(255,255,255,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <AlertTriangle size={18} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 1 }}>
              New Report Arrived
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", lineHeight: 1.3 }}>
              {bannerReport.crime_type ? (
                <><span style={{ textTransform: "capitalize" }}>{bannerReport.crime_type.replace(/-/g, " ")}</span> incident reported</>
              ) : (
                "A new incident has been reported"
              )}
              {bannerReport.location_address && (
                <> &middot; {bannerReport.location_address}</>
              )}
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
            style={{
              background: "rgba(255,255,255,0.15)", border: "none",
              cursor: "pointer", color: "#fff", padding: 6, lineHeight: 0,
              borderRadius: 6, flexShrink: 0,
              transition: "background 0.2s",
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.25)")}
            onMouseOut={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
          >
            <X size={14} />
          </button>
        </div>
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
                  {(item.path === "/reports" || item.path === "/police-tracking") && pendingCount > 0 && (
                    <span className="nav-badge">{pendingCount > 99 ? "99+" : pendingCount}</span>
                  )}
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
