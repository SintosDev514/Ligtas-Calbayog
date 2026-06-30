import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import type { Announcement } from "../types";

export default function Announcements() {
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnnouncements();
    const channel = supabase
      .channel("admin-announcements")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "announcements" },
        () => loadAnnouncements()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadAnnouncements = async () => {
    try {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false });
      if (!error) setAnnouncements(data ?? []);
    } catch (err) {
      console.error("Failed to load announcements:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this announcement?")) return;
    try {
      const { error } = await supabase.from("announcements").delete().eq("id", id);
      if (error) throw error;
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    } catch (err: any) {
      alert("Failed to delete: " + (err.message || "Unknown error"));
    }
  };

  const getImages = (a: Announcement): string[] => {
    if (a.image_urls && Array.isArray(a.image_urls) && a.image_urls.length > 0) return a.image_urls;
    if (a.image_url) return [a.image_url];
    return [];
  };

  const getVideos = (a: Announcement): string[] => {
    if (a.video_urls && Array.isArray(a.video_urls) && a.video_urls.length > 0) return a.video_urls;
    if (a.video_url) return [a.video_url];
    return [];
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-PH", {
      month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
    });

  const categoryColors: Record<string, string> = {
    advisory: "#EFF6FF", alert: "#FEF2F2", news: "#ECFDF5", event: "#F5F3FF",
  };

  const categoryTextColors: Record<string, string> = {
    advisory: "#1D4ED8", alert: "#DC2626", news: "#059669", event: "#7C3AED",
  };

  if (loading) {
    return (
      <div className="page-body" style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h2>Announcements</h2>
        <button className="btn btn-gold" onClick={() => navigate("/announcements/create")}>
          + New Announcement
        </button>
      </div>
      <div className="page-body">
        {announcements.length > 0 ? (
          announcements.map((a) => {
            const images = getImages(a);
            const videos = getVideos(a);
            return (
              <div key={a.id} className="announcement-card">
                <div className="card-header">
                  <div>
                    <span className="badge" style={{ background: categoryColors[a.category] || "#F8FAFC", color: categoryTextColors[a.category] || "#475569", marginBottom: 8 }}>
                      {a.category || "General"}
                    </span>
                    <div className="card-title">{a.title}</div>
                    <div className="card-meta">{formatDate(a.created_at)}</div>
                  </div>
                </div>
                <div className="card-body">{a.content}</div>

                {images.length > 0 && (
                  <div className="announcement-media" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {images.map((url, i) => (
                      <img key={i} src={url} alt="" style={{ maxWidth: 200, maxHeight: 160, borderRadius: 8, objectFit: "cover", border: "1px solid var(--gray-200)" }} />
                    ))}
                  </div>
                )}

                {videos.length > 0 && (
                  <div className="announcement-media" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {videos.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#FEF2F2", borderRadius: 8, color: "#DC2626", fontSize: 13, fontWeight: 500, textDecoration: "none" }}>
                        ▶️ Video {videos.length > 1 ? i + 1 : ""}
                      </a>
                    ))}
                  </div>
                )}

                {a.location_name && (
                  <div className="announcement-location">
                    📍 {a.location_name}
                    {a.latitude && a.longitude && (
                      <span style={{ color: "var(--gray-400)", fontSize: 12 }}>
                        ({a.latitude.toFixed(4)}, {a.longitude.toFixed(4)})
                      </span>
                    )}
                  </div>
                )}

                <div className="card-actions">
                  <button className="btn btn-sm btn-outline" onClick={() => navigate(`/announcements/edit/${a.id}`)}>✏️ Edit</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(a.id)}>🗑️ Delete</button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="empty-state">
            <div className="icon">📢</div>
            <h3>No Announcements Yet</h3>
            <p>Create your first announcement to inform residents</p>
            <button className="btn btn-gold" style={{ marginTop: 16 }} onClick={() => navigate("/announcements/create")}>
              + Create Announcement
            </button>
          </div>
        )}
      </div>
    </>
  );
}
