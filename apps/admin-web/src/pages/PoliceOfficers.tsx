import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { Users, Search, ChevronLeft, ChevronRight, Shield, Phone, MapPin } from "lucide-react";

const ITEMS_PER_PAGE = 15;

export default function PoliceOfficers() {
  const [officers, setOfficers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const channel = supabase
      .channel("admin-police-officers")
      .on("postgres_changes", { event: "*", schema: "public", table: "police_profiles" }, () => load())
      .subscribe();
    load();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const load = async () => {
    const { data } = await supabase.from("police_profiles").select("*").order("full_name");
    if (data) setOfficers(data);
    setLoading(false);
  };

  const filtered = officers.filter((o) => {
    const q = search.toLowerCase();
    return (
      o.full_name?.toLowerCase().includes(q) ||
      o.badge_id?.toLowerCase().includes(q) ||
      o.rank?.toLowerCase().includes(q) ||
      o.station?.toLowerCase().includes(q)
    );
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
        <h2><Users size={22} /> Police Officers</h2>
        <span className="badge">{filtered.length} officers</span>
      </div>
      <div className="page-body">
        <div className="filters-bar">
          <div className="search-wrapper">
            <Search size={16} />
            <input
              className="search-input"
              placeholder="Search officers..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <span className="filter-count">{filtered.length} results</span>
        </div>

        {paginated.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><Users size={40} /></div>
            <h3>No officers found</h3>
            <p>Police profiles will appear here.</p>
          </div>
        ) : (
          <>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Badge ID</th>
                    <th>Rank</th>
                    <th>Station</th>
                    <th>Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((o) => (
                    <tr key={o.id}>
                      <td><strong>{o.full_name}</strong></td>
                      <td><span className="badge"><Shield size={12} /> {o.badge_id}</span></td>
                      <td>{o.rank}</td>
                      <td><MapPin size={12} /> {o.station}</td>
                      <td>{o.phone_number ? <><Phone size={12} /> {o.phone_number}</> : "—"}</td>
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
