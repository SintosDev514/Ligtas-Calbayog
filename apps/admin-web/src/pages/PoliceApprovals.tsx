import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import {
  UserCheck,
  Search,
  Phone,
  Shield,
  MapPin,
  Clock,
  CheckCircle2,
  Image as ImageIcon,
} from "lucide-react";

export default function PoliceApprovals() {
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [approvingId, setApprovingId] = useState<string | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel("admin-police-approvals")
      .on("postgres_changes", { event: "*", schema: "public", table: "police_profiles" }, () => load())
      .subscribe();
    load();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const load = async () => {
    const { data } = await supabase
      .from("police_profiles")
      .select("*")
      .eq("is_approved", false)
      .order("created_at", { ascending: true });
    if (data) setPending(data);
    setLoading(false);
  };

  const approve = async (o: any) => {
    if (!window.confirm(`Approve ${o.full_name} (${o.badge_id}) to use the Police App?`)) return;
    setApprovingId(o.id);
    const { error } = await supabase
      .from("police_profiles")
      .update({ is_approved: true, updated_at: new Date().toISOString() })
      .eq("id", o.id);
    setApprovingId(null);
    if (error) {
      alert(error.message || "Failed to approve account.");
      return;
    }
    load();
  };

  const filtered = pending.filter((o) => {
    const q = search.toLowerCase();
    return (
      o.full_name?.toLowerCase().includes(q) ||
      o.badge_id?.toLowerCase().includes(q) ||
      o.rank?.toLowerCase().includes(q) ||
      o.station?.toLowerCase().includes(q) ||
      o.phone_number?.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="page-body">
        <div aria-label="Loading..." role="status" className="loader">
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
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h2><UserCheck size={22} /> Police Account Approvals</h2>
        <span className="badge">{filtered.length} pending</span>
      </div>
      <div className="page-body">
        <div className="filters-bar">
          <div className="search-wrapper">
            <Search size={16} />
            <input
              className="search-input"
              placeholder="Search pending officers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className="filter-count">{filtered.length} results</span>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><CheckCircle2 size={40} /></div>
            <h3>No pending approvals</h3>
            <p>New police registrations will appear here until an admin approves them.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Badge ID</th>
                  <th>Rank</th>
                  <th>Station</th>
                  <th>Contact</th>
                  <th>Police ID</th>
                  <th>Registered</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr key={o.id}>
                    <td><strong>{o.full_name}</strong></td>
                    <td><span className="badge"><Shield size={12} /> {o.badge_id}</span></td>
                    <td>{o.rank}</td>
                    <td><MapPin size={12} /> {o.station}</td>
                    <td>{o.phone_number ? <><Phone size={12} /> {o.phone_number}</> : "—"}</td>
                    <td>
                      {o.police_id_photo_url ? (
                        <img
                          src={o.police_id_photo_url}
                          alt="Police ID"
                          style={{ width: 44, height: 44, borderRadius: 6, objectFit: "cover", cursor: "pointer", border: "1px solid var(--border, #E2E8F0)" }}
                          onClick={() => window.open(o.police_id_photo_url, "_blank")}
                        />
                      ) : (
                        <span style={{ opacity: 0.5 }}><ImageIcon size={16} /> No ID</span>
                      )}
                    </td>
                    <td><span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Clock size={12} /> {o.created_at ? new Date(o.created_at).toLocaleString() : "—"}</span></td>
                    <td>
                      <button
                        className="btn-primary"
                        style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                        disabled={approvingId === o.id}
                        onClick={() => approve(o)}
                      >
                        {approvingId === o.id ? "Approving..." : <><CheckCircle2 size={14} /> Approve</>}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}