import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { Calendar, Clock, Users, Sun, Moon, Sunrise, Sunset } from "lucide-react";

export default function ShiftSchedule() {
  const [officers, setOfficers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const { data } = await supabase.from("police_profiles").select("*").order("full_name");
    if (data) setOfficers(data);
    setLoading(false);
  };

  const shifts = [
    { name: "Morning", icon: Sunrise, time: "06:00 - 14:00", color: "var(--orange)", bg: "rgba(245,158,11,0.1)", officers: officers.slice(0, Math.ceil(officers.length / 3)) },
    { name: "Afternoon", icon: Sun, time: "14:00 - 22:00", color: "var(--gold)", bg: "rgba(244,181,26,0.1)", officers: officers.slice(Math.ceil(officers.length / 3), Math.ceil(2 * officers.length / 3)) },
    { name: "Night", icon: Moon, time: "22:00 - 06:00", color: "var(--blue)", bg: "rgba(37,99,235,0.1)", officers: officers.slice(Math.ceil(2 * officers.length / 3)) },
  ];

  if (loading) return <div className="page-body"><div className="spinner" /></div>;

  return (
    <>
      <div className="page-header">
        <h2><Calendar size={22} /> Shift Schedule</h2>
        <span className="badge">{officers.length} officers</span>
      </div>
      <div className="page-body">
        {officers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><Calendar size={40} /></div>
            <h3>No schedule available</h3>
            <p>Officer shift assignments will appear here once added.</p>
          </div>
        ) : (
          <div className="stats-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))" }}>
            {shifts.map((shift) => (
              <div className="card" key={shift.name}>
                <div className="card-body">
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                    <div className="stat-icon" style={{ background: shift.bg, color: shift.color }}>
                      <shift.icon size={22} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 600 }}>{shift.name} Shift</h3>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--gray-500)" }}>
                        <Clock size={13} /> {shift.time}
                      </div>
                    </div>
                  </div>
                  {shift.officers.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {shift.officers.map((o: any) => (
                        <div key={o.id} style={{
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          padding: "8px 10px", background: "var(--gray-50)", borderRadius: "var(--radius-sm)"
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: shift.color }} />
                            <span style={{ fontWeight: 500, fontSize: 14 }}>{o.full_name}</span>
                          </div>
                          <span style={{ fontSize: 12, color: "var(--gray-500)" }}>
                            {o.rank} — {o.badge_id}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ textAlign: "center", padding: "20px 0", color: "var(--gray-400)", fontSize: 13 }}>
                      No officers assigned
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
