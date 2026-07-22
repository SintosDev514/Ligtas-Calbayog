import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import {
  Users as UsersIcon, Shield, User, Search, ChevronLeft, ChevronRight,
  Ban, CheckCircle, Eye, Phone, MapPin, RefreshCw, X, Send, PauseCircle,
  AlertTriangle, FileText, Clock, CheckCircle2, XCircle, MessageSquare
} from "lucide-react";

const ITEMS_PER_PAGE = 15;

const TABS = [
  { id: "police", label: "Police Users", icon: Shield },
  { id: "resident", label: "Resident Users", icon: User },
  { id: "admin", label: "Web Admin", icon: UsersIcon },
];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  approved: { bg: "rgba(16,185,129,0.15)", text: "#10b981" },
  suspended: { bg: "rgba(251,191,36,0.15)", text: "#fbbf24" },
  banned: { bg: "rgba(239,68,68,0.15)", text: "#ef4444" },
  pending: { bg: "rgba(96,165,250,0.15)", text: "#60a5fa" },
};

export default function Users() {
  const [activeTab, setActiveTab] = useState("police");
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [updating, setUpdating] = useState<string | null>(null);

  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [userStatus, setUserStatus] = useState<string>("approved");
  const [userStats, setUserStats] = useState({ total: 0, pending: 0, inProgress: 0, resolved: 0, dismissed: 0 });
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [showMessageInput, setShowMessageInput] = useState(false);

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
      const { data: assignments } = await supabase
        .from("police_post_assignments")
        .select("officer_id, post_id");
      const { data: posts } = await supabase
        .from("police_posts")
        .select("id, name");
      const postNameMap: Record<string, string | null> = {};
      if (posts) for (const p of posts) postNameMap[p.id] = p.name;
      const postMap: Record<string, string | null> = {};
      if (assignments) {
        for (const a of assignments) {
          postMap[a.officer_id] = postNameMap[a.post_id] ?? null;
        }
      }
      data = (d || []).map((p) => ({ ...p, assigned_post: postMap[p.id] || null }));
    } else if (activeTab === "resident") {
      const { data: d, error } = await supabase.from("resident_profiles").select("*").order("full_name");
      if (error) console.error("resident_profiles query error:", error);
      const profiles = d || [];
      if (profiles.length > 0) {
        const ids = profiles.map((p: any) => p.id);
        const { data: usersData } = await supabase.from("users").select("id, status, email").in("id", ids);
        const statusMap: Record<string, string> = {};
        const emailMap: Record<string, string> = {};
        if (usersData) for (const u of usersData) { statusMap[u.id] = u.status; emailMap[u.id] = u.email; }
        data = profiles.map((p: any) => ({ ...p, status: statusMap[p.id] || "approved", email: emailMap[p.id] || null }));
      } else {
        data = profiles;
      }
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

  const openUserDetail = async (user: any) => {
    setSelectedUser(user);
    setLoadingDetail(true);
    setShowMessageInput(false);
    setMessageText("");

    if (activeTab === "resident") {
      const { data: userData } = await supabase.from("users").select("status").eq("id", user.id).single();
      setUserStatus(userData?.status || "approved");

      const { data: reports } = await supabase.from("crime_reports").select("status").eq("resident_id", user.id);
      const all = reports || [];
      setUserStats({
        total: all.length,
        pending: all.filter((r) => r.status === "pending").length,
        inProgress: all.filter((r) => r.status === "in-progress").length,
        resolved: all.filter((r) => r.status === "resolved").length,
        dismissed: all.filter((r) => r.status === "dismissed").length,
      });
    }

    setLoadingDetail(false);
  };

  const updateUserStatus = async (status: string) => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      const { error } = await supabase.from("users").update({ status }).eq("id", selectedUser.id);
      if (error) {
        console.error("Supabase update error:", error);
        alert("Failed to update status: " + error.message);
        return;
      }
      setUserStatus(status);
      setUsers((prev) => prev.map((u) => {
        if (u.id === selectedUser.id) return { ...u, status };
        return u;
      }));
    } catch (e) {
      console.error("Failed to update user status:", e);
      alert("Failed to update status: " + (e as any)?.message);
    } finally {
      setActionLoading(false);
    }
  };

  const sendNotification = async () => {
    if (!selectedUser || !messageText.trim()) return;
    setActionLoading(true);
    try {
      const { error } = await supabase.from("notifications").insert({
        user_id: selectedUser.id,
        type: "admin_message",
        title: "Message from PNP Calbayog",
        body: messageText.trim(),
        data: { from: "admin" },
        created_at: new Date().toISOString(),
      });
      if (error) {
        console.error("Supabase insert error:", error);
        alert("Failed to send notification: " + error.message);
        return;
      }
      setMessageText("");
      setShowMessageInput(false);
      alert("Notification sent!");
    } catch (e) {
      console.error("Failed to send notification:", e);
      alert("Failed to send notification: " + (e as any)?.message);
    } finally {
      setActionLoading(false);
    }
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
                color: activeTab === tab.id ? "var(--navy)" : "var(--gray-600)",
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
                        <th>Assigned Post</th>
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
                          <td>{u.assigned_post ? <span className="badge"><MapPin size={12} /> {u.assigned_post}</span> : "—"}</td>
                          <td>{u.phone_number ? <><Phone size={12} /> {u.phone_number}</> : "—"}</td>
                          <td style={{ textAlign: "center" }}>
                            <button className="btn-ghost btn-sm" title="View details" style={{ color: "var(--blue)" }} onClick={() => openUserDetail(u)}>
                              <Eye size={15} />
                            </button>
                          </td>
                        </>
                      )}
                      {activeTab === "resident" && (
                        <>
                          <td>
                            <button
                              onClick={() => openUserDetail(u)}
                              style={{
                                background: "none", border: "none", cursor: "pointer",
                                fontWeight: 500, color: "var(--blue)", padding: 0, fontSize: "inherit", fontFamily: "inherit",
                              }}
                            >
                              {u.full_name}
                            </button>
                          </td>
                          <td>{u.phone_number || "—"}</td>
                          <td>{u.address || "—"}</td>
                          <td style={{ textAlign: "center" }}>
                            <button className="btn-ghost btn-sm" title="View details" style={{ color: "var(--blue)" }} onClick={() => openUserDetail(u)}>
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
                                onClick={() => openUserDetail(u)}
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

      {selectedUser && (
        <div style={{
          position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1000, padding: 20,
        }} onClick={() => setSelectedUser(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "var(--navy-light)", borderRadius: "var(--radius-lg)",
              width: "100%", maxWidth: 580, maxHeight: "85vh", overflow: "auto",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            }}
          >
            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "20px 24px", borderBottom: "1px solid var(--gray-200)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {selectedUser.photo_url || selectedUser.avatar_url ? (
                  <img
                    src={selectedUser.photo_url || selectedUser.avatar_url}
                    alt="Profile"
                    style={{
                      width: 48, height: 48, borderRadius: 24,
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <div style={{
                    width: 48, height: 48, borderRadius: 24,
                    backgroundColor: activeTab === "resident" ? "var(--blue-light)" : "var(--green-light)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18, fontWeight: 700,
                    color: activeTab === "resident" ? "var(--blue)" : "var(--green)",
                  }}>
                    {selectedUser.full_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "?"}
                  </div>
                )}
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--gray-800)" }}>
                    {selectedUser.full_name || selectedUser.email || "User"}
                  </h3>
                  <span style={{ fontSize: 13, color: "var(--gray-500)" }}>
                    {activeTab === "police" ? "Police Officer" : activeTab === "resident" ? "Resident" : "Admin"}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                style={{
                  background: "var(--gray-100)", border: "none", borderRadius: 8,
                  width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", color: "var(--gray-500)",
                }}
              >
                <X size={18} />
              </button>
            </div>

            {loadingDetail ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--gray-500)" }}>
                <RefreshCw size={24} className="spinning" />
                <p style={{ marginTop: 12 }}>Loading details...</p>
              </div>
            ) : (
              <div style={{ padding: "20px 24px" }}>
                {/* Account Status */}
                {activeTab === "resident" && (
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "6px 14px", borderRadius: 20,
                    backgroundColor: STATUS_COLORS[userStatus]?.bg || "var(--gray-100)",
                    color: STATUS_COLORS[userStatus]?.text || "var(--gray-600)",
                    fontSize: 13, fontWeight: 600, marginBottom: 20,
                  }}>
                    {userStatus === "banned" ? <Ban size={14} /> :
                     userStatus === "suspended" ? <PauseCircle size={14} /> :
                     <CheckCircle2 size={14} />}
                    {userStatus?.charAt(0).toUpperCase() + userStatus?.slice(1)}
                  </div>
                )}

                {/* Info Fields */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px", marginBottom: 20 }}>
                  {activeTab === "resident" && (
                    <>
                      <InfoField label="Phone" value={selectedUser.phone_number} icon={<Phone size={13} />} />
                      <InfoField label="Emergency Contact" value={selectedUser.emergency_contact} icon={<Phone size={13} />} />
                      <InfoField label="Address" value={selectedUser.address} icon={<MapPin size={13} />} fullWidth />
                      <InfoField label="Guardian" value={selectedUser.guardian_name} icon={<User size={13} />} />
                      <InfoField label="Guardian Phone" value={selectedUser.guardian_phone} icon={<Phone size={13} />} />
                      <InfoField label="Father" value={selectedUser.father_name} icon={<User size={13} />} />
                      <InfoField label="Father Phone" value={selectedUser.father_phone} icon={<Phone size={13} />} />
                      <InfoField label="Mother" value={selectedUser.mother_name} icon={<User size={13} />} />
                      <InfoField label="Mother Phone" value={selectedUser.mother_phone} icon={<Phone size={13} />} />
                      <InfoField label="Email" value={selectedUser.email} icon={<Send size={13} />} fullWidth />
                      <InfoField label="User ID" value={selectedUser.id} icon={<FileText size={13} />} mono fullWidth />
                    </>
                  )}
                  {activeTab === "police" && (
                    <>
                      <InfoField label="Badge ID" value={selectedUser.badge_id} icon={<Shield size={13} />} />
                      <InfoField label="Rank" value={selectedUser.rank} icon={<BadgeIcon size={13} />} />
                      <InfoField label="Station" value={selectedUser.station} icon={<MapPin size={13} />} />
                      <InfoField label="Assigned Post" value={selectedUser.assigned_post} icon={<MapPin size={13} />} />
                      <InfoField label="Phone" value={selectedUser.phone_number} icon={<Phone size={13} />} />
                      <InfoField label="User ID" value={selectedUser.id?.slice(0, 8)} icon={<FileText size={13} />} mono />
                    </>
                  )}
                  {activeTab === "admin" && (
                    <>
                      <InfoField label="Email" value={selectedUser.email} icon={<Send size={13} />} fullWidth />
                      <InfoField label="Role" value={selectedUser.role} icon={<Shield size={13} />} />
                      <InfoField label="Status" value={selectedUser.is_active !== false ? "Active" : "Inactive"} icon={<CheckCircle2 size={13} />} />
                      <InfoField label="User ID" value={selectedUser.id?.slice(0, 8)} icon={<FileText size={13} />} mono />
                    </>
                  )}
                </div>

                {/* ID Photo Verification */}
                {activeTab === "resident" && selectedUser.id_photo_url && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--gray-500)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
                      ID Verification
                    </div>
                    <div style={{
                      backgroundColor: "var(--gray-100)", borderRadius: "var(--radius-md)",
                      padding: 12, display: "flex", alignItems: "center", gap: 14,
                    }}>
                      <img
                        src={selectedUser.id_photo_url}
                        alt="ID Photo"
                        style={{
                          width: 120, height: 80, objectFit: "cover",
                          borderRadius: "var(--radius-sm)", border: "2px solid var(--gray-200)",
                        }}
                      />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--gray-700)" }}>Government ID</div>
                        <div style={{ fontSize: 12, color: "var(--gray-500)", marginTop: 2 }}>Uploaded during registration</div>
                        <a
                          href={selectedUser.id_photo_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            fontSize: 12, fontWeight: 600, color: "var(--blue)",
                            marginTop: 6, textDecoration: "none",
                          }}
                        >
                          <Eye size={12} /> View Full Size
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {/* Report Stats for Residents */}
                {activeTab === "resident" && (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--gray-500)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
                      Report Activity
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 24 }}>
                      <StatCard label="Total" value={userStats.total} color="var(--blue)" bg="var(--blue-light)" icon={<FileText size={14} />} />
                      <StatCard label="Pending" value={userStats.pending} color="var(--orange)" bg="var(--orange-light)" icon={<Clock size={14} />} />
                      <StatCard label="In Progress" value={userStats.inProgress} color="var(--purple)" bg="var(--purple-light)" icon={<RefreshCw size={14} />} />
                      <StatCard label="Resolved" value={userStats.resolved} color="var(--green)" bg="var(--green-light)" icon={<CheckCircle2 size={14} />} />
                      <StatCard label="Dismissed" value={userStats.dismissed} color="var(--gray-400)" bg="var(--gray-100)" icon={<XCircle size={14} />} />
                    </div>
                  </>
                )}

                {/* Actions */}
                {activeTab === "resident" && (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--gray-500)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
                      Actions
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: showMessageInput ? 12 : 0 }}>
                      {userStatus !== "approved" && (
                        <button
                          onClick={() => updateUserStatus("approved")}
                          disabled={actionLoading}
                          style={{
                            display: "flex", alignItems: "center", gap: 6,
                            padding: "8px 16px", borderRadius: "var(--radius-md)",
                            border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
                            backgroundColor: "var(--green-light)", color: "var(--green)",
                          }}
                        >
                          <CheckCircle2 size={15} /> Approve
                        </button>
                      )}
                      {userStatus !== "suspended" && (
                        <button
                          onClick={() => updateUserStatus("suspended")}
                          disabled={actionLoading}
                          style={{
                            display: "flex", alignItems: "center", gap: 6,
                            padding: "8px 16px", borderRadius: "var(--radius-md)",
                            border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
                            backgroundColor: "var(--orange-light)", color: "var(--orange)",
                          }}
                        >
                          <PauseCircle size={15} /> Suspend
                        </button>
                      )}
                      {userStatus !== "banned" && (
                        <button
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to ban ${selectedUser.full_name}? This will prevent them from logging in.`)) {
                              updateUserStatus("banned");
                            }
                          }}
                          disabled={actionLoading}
                          style={{
                            display: "flex", alignItems: "center", gap: 6,
                            padding: "8px 16px", borderRadius: "var(--radius-md)",
                            border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
                            backgroundColor: "var(--red-light)", color: "var(--red)",
                          }}
                        >
                          <Ban size={15} /> Ban
                        </button>
                      )}
                      <button
                        onClick={() => setShowMessageInput(!showMessageInput)}
                        style={{
                          display: "flex", alignItems: "center", gap: 6,
                          padding: "8px 16px", borderRadius: "var(--radius-md)",
                          border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
                          backgroundColor: "var(--blue-light)", color: "var(--blue)",
                        }}
                      >
                        <MessageSquare size={15} /> Send Notification
                      </button>
                    </div>

                    {showMessageInput && (
                      <div style={{
                        backgroundColor: "var(--gray-100)", borderRadius: "var(--radius-md)",
                        padding: 14, marginTop: 8,
                      }}>
                        <textarea
                          value={messageText}
                          onChange={(e) => setMessageText(e.target.value)}
                          placeholder="Type a message to send as a notification..."
                          rows={3}
                          style={{
                            width: "100%", resize: "vertical",
                            backgroundColor: "var(--navy-light)", border: "1px solid var(--gray-200)",
                            borderRadius: "var(--radius-sm)", padding: 10, fontSize: 13,
                            color: "var(--gray-800)", fontFamily: "var(--font-sans)",
                          }}
                        />
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                          <button
                            onClick={() => { setShowMessageInput(false); setMessageText(""); }}
                            style={{
                              padding: "7px 14px", borderRadius: "var(--radius-sm)",
                              border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500,
                              backgroundColor: "var(--gray-200)", color: "var(--gray-600)",
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={sendNotification}
                            disabled={!messageText.trim() || actionLoading}
                            style={{
                              display: "flex", alignItems: "center", gap: 6,
                              padding: "7px 14px", borderRadius: "var(--radius-sm)",
                              border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
                              backgroundColor: messageText.trim() ? "var(--blue)" : "var(--gray-300)",
                              color: "#fff", opacity: actionLoading ? 0.6 : 1,
                            }}
                          >
                            <Send size={13} /> {actionLoading ? "Sending..." : "Send"}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function InfoField({ label, value, icon, fullWidth, mono }: {
  label: string; value: string | null | undefined; icon?: React.ReactNode;
  fullWidth?: boolean; mono?: boolean;
}) {
  return (
    <div style={{ gridColumn: fullWidth ? "span 2" : undefined }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
        <span style={{ color: "var(--gray-500)" }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--gray-500)", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</span>
      </div>
      <div style={{
        fontSize: 14, fontWeight: 500, color: value ? "var(--gray-800)" : "var(--gray-400)",
        fontFamily: mono ? "var(--font-mono)" : "inherit",
      }}>
        {value || "—"}
      </div>
    </div>
  );
}

function StatCard({ label, value, color, bg, icon }: {
  label: string; value: number; color: string; bg: string; icon: React.ReactNode;
}) {
  return (
    <div style={{
      backgroundColor: bg, borderRadius: "var(--radius-md)", padding: "10px 8px",
      textAlign: "center",
    }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 4, color }}>
        {icon}
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 10, fontWeight: 600, color, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 }}>{label}</div>
    </div>
  );
}
