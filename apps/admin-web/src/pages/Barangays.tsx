import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { MapPin, Users, FileText, AlertTriangle, ChevronLeft, ChevronRight, Search } from "lucide-react";

const ITEMS_PER_PAGE = 15;

const BARANGAYS = [
  "Bagacay", "Bantayan", "Binaliw", "Borobathon", "Cabilawan", "Calbayog",
  "Canhabagat", "Caponayan", "Carayman", "Cogon", "Dalahican", "Danao",
  "Ginabuyan", "Jiabong", "Lagdagan", "Lalab", "Lampano", "Lantaw",
  "Lawaan", "Lonoy", "Lunao", "Mabini", "Malaga", "Malajog",
  "Maya", "Obrero", "Pajo", "Palanas", "Pangdan", "Rawis",
  "San Policarpo", "Santo Niño", "Tagumpay", "Tinambacan", "Tominamos", "Tugas",
];

export default function Barangays() {
  const [barangayStats, setBarangayStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const channel = supabase
      .channel("admin-barangays")
      .on("postgres_changes", { event: "*", schema: "public", table: "crime_reports" }, () => load())
      .subscribe();
    load();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const load = async () => {
    const { data } = await supabase.from("crime_reports").select("location_address, status, id");
    const stats: Record<string, { total: number; resolved: number; active: number }> = {};

    for (const name of BARANGAYS) {
      stats[name] = { total: 0, resolved: 0, active: 0 };
    }
    stats["Other"] = { total: 0, resolved: 0, active: 0 };

    for (const r of data || []) {
      const addr = (r.location_address || "").toLowerCase();
      let matched = "Other";
      for (const name of BARANGAYS) {
        if (addr.includes(name.toLowerCase())) {
          matched = name;
          break;
        }
      }
      stats[matched].total++;
      if (r.status === "resolved") stats[matched].resolved++;
      else stats[matched].active++;
    }

    setBarangayStats(
      Object.entries(stats)
        .map(([name, s]) => ({ name, ...s }))
        .sort((a, b) => b.total - a.total)
    );
    setLoading(false);
  };

  const filtered = barangayStats.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()));
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  if (loading) return <div className="page-body"><div className="honeycomb"><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div></div>;

  return (
    <>
      <div className="page-header">
        <h2><MapPin size={22} /> Barangays</h2>
        <span className="badge">{BARANGAYS.length} barangays</span>
      </div>
      <div className="page-body">
        <div className="filters-bar">
          <div className="search-wrapper">
            <Search size={16} />
            <input className="search-input" placeholder="Search barangay..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <span className="filter-count">{filtered.length} results</span>
        </div>

        {paginated.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><MapPin size={40} /></div>
            <h3>No barangay data</h3>
            <p>Crime data will be grouped by barangay here.</p>
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
              {paginated.map((b) => (
                <div className="card" key={b.name}>
                  <div className="card-body">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 600 }}>{b.name}</h3>
                      <span className="badge">{b.total}</span>
                    </div>
                    <div style={{ display: "flex", gap: 12, fontSize: 13 }}>
                      <span style={{ color: "var(--red)" }}><AlertTriangle size={13} /> {b.active} active</span>
                      <span style={{ color: "var(--green)" }}>✓ {b.resolved} resolved</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="pagination" style={{ marginTop: 16 }}>
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
