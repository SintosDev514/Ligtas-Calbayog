import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { Shield, ShieldCheck, ShieldAlert, Users, FileText, Settings, Bell } from "lucide-react";

const ROLES = [
  {
    name: "Super Admin",
    icon: ShieldAlert,
    color: "var(--red)",
    bg: "rgba(239,68,68,0.1)",
    description: "Full system access",
    permissions: ["All modules", "User management", "Role configuration", "System settings"],
    count: 0,
  },
  {
    name: "Admin",
    icon: ShieldCheck,
    color: "var(--gold)",
    bg: "rgba(244,181,26,0.1)",
    description: "Administrative access",
    permissions: ["Incidents", "Personnel", "Analytics", "Community"],
    count: 0,
  },
  {
    name: "Officer",
    icon: Shield,
    color: "var(--blue)",
    bg: "rgba(37,99,235,0.1)",
    description: "Field operations access",
    permissions: ["View incidents", "Update status", "Patrol logs", "Location tracking"],
    count: 0,
  },
  {
    name: "Viewer",
    icon: Users,
    color: "var(--gray-500)",
    bg: "rgba(100,116,139,0.1)",
    description: "Read-only access",
    permissions: ["View reports", "View analytics", "View personnel"],
    count: 0,
  },
];

export default function Roles() {
  const [loading, setLoading] = useState(true);
  const [userCounts, setUserCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const { data } = await supabase.from("users").select("role");
    const counts: Record<string, number> = {};
    for (const u of data || []) {
      const role = (u.role || "viewer").toLowerCase();
      counts[role] = (counts[role] || 0) + 1;
    }
    setUserCounts(counts);
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
        <h2><Shield size={22} /> Roles</h2>
        <span className="badge">{ROLES.length} roles</span>
      </div>
      <div className="page-body">
        <div className="stats-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
          {ROLES.map((role) => (
            <div className="card" key={role.name}>
              <div className="card-body">
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <div className="stat-icon" style={{ background: role.bg, color: role.color, width: 44, height: 44 }}>
                    <role.icon size={22} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 600 }}>{role.name}</h3>
                    <span style={{ fontSize: 13, color: "var(--gray-500)" }}>{role.description}</span>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {role.permissions.map((p) => (
                    <div key={p} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--gray-600)" }}>
                      <span style={{ color: "var(--green)" }}>✓</span> {p}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
