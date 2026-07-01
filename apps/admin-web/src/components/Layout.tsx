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
  LogOut, ChevronLeft
} from "lucide-react";
import { useState } from "react";

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

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="layout">
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
