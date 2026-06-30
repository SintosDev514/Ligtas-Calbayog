import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import {
  Users as UsersIcon, Shield, User, Search, ChevronLeft, ChevronRight,
  Ban, CheckCircle, Eye, Phone, MapPin, BadgeIcon, RefreshCw
} from "lucide-react";

const ITEMS_PER_PAGE = 15;

const TABS = [
  { id: "police", label: "Police Users", icon: Shield },
  { id: "resident", label: "Resident Users", icon: User },
  { id: "admin", label: "Web Admin", icon: UsersIcon },
];

export default function Users() {
  const [activeTab, setActiveTab] = useState("police");
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
    setSearch("");
    load();
  }, [activeTab]);

  const load = async () => {
    setLoading(true);
    let data: any[] | null = [];

    if (activeTab === "police") {
      const { data: d, error } = await supabase.from("police_profiles").select("*").order("full_name");
      if (error) console.error("police_profiles query error:", error);
      data = d;
    } else if (activeTab === "resident") {
      const { data: d, error } = await supabase.from("resident_profiles").select("*").order("full_name");
      if (error) console.error("resident_profiles query error:", error);
      data = d;
    } else {
      const { data: d, error } = await supabase.from("users").select("*").order("email");
      if (error) console.error("users query error:", error);
      data = d;
    }

    setUsers(data || []);
    setLoading(false);
  };

  const toggleStatus = async (id: string, current: boolean) => {
    setUpdating(id);
    await supabase.from("users").update({ is_active: !current }).eq("id", id);
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, is_active: !current } : u)));
    setUpdating(null);
  };

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    if (activeTab === "police" || activeTab === "resident") {
      return (
        u.full_name?.toLowerCase().includes(q) ||
        u.phone_number?.toLowerCase().includes(q) ||
        u.address?.toLowerCase().includes(q)
      );
    }
    return u.email?.toLowerCase().includes(q) || u.role?.toLowerCase().includes(q);
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  if (loading) return <div className="page-body"><div className="spinner" /></div>;

  return (
    <>
      <div className="page-header">
        <h2><UsersIcon size={22} /> Users</h2>
        <span className="badge">{users.length} users</span>
      </div>
      <div className="page-body">
        <div className="tabs" style={{ display: "flex", gap: 4, marginBottom: 16 }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 18px", borderRadius: "var(--radius-md)",
                border: "none", cursor: "pointer", fontSize: 14, fontWeight: 500,
                background: activeTab === tab.id ? "var(--gold)" : "var(--gray-100)",
                color: activeTab === tab.id ? "#fff" : "var(--gray-600)",
                transition: "all 0.2s",
              }}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="filters-bar">
          <div className="search-wrapper">
            <Search size={16} />
            <input className="search-input" placeholder={`Search ${activeTab} users...`} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <span className="filter-count">{filtered.length} results</span>
        </div>

        {paginated.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><UsersIcon size={40} /></div>
            <h3>No {activeTab} users found</h3>
            <p>User accounts will appear here.</p>
          </div>
        ) : (
          <>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    {activeTab === "police" && (
                      <>
                        <th>Name</th>
                        <th>Badge ID</th>
                        <th>Rank</th>
                        <th>Station</th>
                        <th>Contact</th>
                        <th style={{ textAlign: "center" }}>Action</th>
                      </>
                    )}
                    {activeTab === "resident" && (
                      <>
                        <th>Name</th>
                        <th>Phone</th>
                        <th>Address</th>
                        <th style={{ textAlign: "center" }}>Action</th>
                      </>
                    )}
                    {activeTab === "admin" && (
                      <>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th style={{ textAlign: "center" }}>Action</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((u) => (
                    <tr key={u.id}>
                      {activeTab === "police" && (
                        <>
                          <td style={{ fontWeight: 500 }}>{u.full_name}</td>
                          <td><span className="badge"><Shield size={12} /> {u.badge_id}</span></td>
                          <td>{u.rank}</td>
                          <td><MapPin size={12} /> {u.station}</td>
                          <td>{u.phone_number ? <><Phone size={12} /> {u.phone_number}</> : "—"}</td>
                          <td style={{ textAlign: "center" }}>
                            <button className="btn-ghost btn-sm" title="View details" style={{ color: "var(--blue)" }}>
                              <Eye size={15} />
                            </button>
                          </td>
                        </>
                      )}
                      {activeTab === "resident" && (
                        <>
                          <td style={{ fontWeight: 500 }}>{u.full_name}</td>
                          <td>{u.phone_number || "—"}</td>
                          <td>{u.address || "—"}</td>
                          <td style={{ textAlign: "center" }}>
                            <button className="btn-ghost btn-sm" title="View details" style={{ color: "var(--blue)" }}>
                              <Eye size={15} />
                            </button>
                          </td>
                        </>
                      )}
                      {activeTab === "admin" && (
                        <>
                          <td style={{ fontWeight: 500 }}>{u.email}</td>
                          <td>
                            <span className="badge">
                              <Shield size={12} /> {u.role || "user"}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${u.is_active !== false ? "badge-resolved" : "badge-pending"}`}>
                              {u.is_active !== false ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                              <button
                                className="btn-ghost btn-sm"
                                title="View details"
                                style={{ color: "var(--blue)" }}
                              >
                                <Eye size={15} />
                              </button>
                              <button
                                className="btn-ghost btn-sm"
                                title={u.is_active !== false ? "Deactivate" : "Activate"}
                                onClick={() => toggleStatus(u.id, u.is_active !== false)}
                                disabled={updating === u.id}
                                style={{ color: u.is_active !== false ? "var(--red)" : "var(--green)" }}
                              >
                                {updating === u.id ? <RefreshCw size={15} className="spinning" /> : u.is_active !== false ? <Ban size={15} /> : <CheckCircle size={15} />}
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <button className="btn-ghost" disabled={page === 1} onClick={() => setPage(page - 1)}>
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => (
                  <button key={i + 1} className={page === i + 1 ? "btn-primary" : "btn-ghost"} onClick={() => setPage(i + 1)}>
                    {i + 1}
                  </button>
                ))}
                <button className="btn-ghost" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
