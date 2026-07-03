import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { Shield, MapPin, Users } from "lucide-react";

export default function PatrolUnits() {
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const channel = supabase
      .channel("admin-patrol-units")
      .on("postgres_changes", { event: "*", schema: "public", table: "police_profiles" }, () => load())
      .subscribe();
    load();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const load = async () => {
    const { data } = await supabase.from("police_profiles").select("*").order("station");
    if (data) {
      const grouped: Record<string, any[]> = {};
      for (const o of data) {
        const station = o.station || "Unassigned";
        if (!grouped[station]) grouped[station] = [];
        grouped[station].push(o);
      }
      setUnits(Object.entries(grouped).map(([station, officers]) => ({ station, officers })));
    }
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
        <h2><Shield size={22} /> Patrol Units</h2>
        <span className="badge">{units.length} units</span>
      </div>
      <div className="page-body">
        {units.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><Shield size={40} /></div>
            <h3>No patrol units</h3>
            <p>Officers will be grouped by station here.</p>
          </div>
        ) : (
          <div className="stats-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))" }}>
            {units.map((unit) => (
              <div className="card" key={unit.station}>
                <div className="card-body">
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <div className="stat-icon" style={{ background: "rgba(244,181,26,0.12)", color: "var(--gold)" }}>
                      <MapPin size={20} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 600 }}>{unit.station}</h3>
                      <span style={{ fontSize: 13, color: "var(--gray-500)" }}>
                        <Users size={13} /> {unit.officers.length} officer{unit.officers.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {unit.officers.map((o: any) => (
                      <div key={o.id} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "8px 10px", background: "var(--gray-50)", borderRadius: "var(--radius-sm)"
                      }}>
                        <span style={{ fontWeight: 500, fontSize: 14 }}>{o.full_name}</span>
                        <span style={{ fontSize: 12, color: "var(--gray-500)" }}>
                          {o.rank} — {o.badge_id}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
