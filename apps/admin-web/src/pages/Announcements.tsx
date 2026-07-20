import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { useToast } from "../context/ToastContext";
import type { Announcement } from "../types";
import {
  Megaphone, Plus, Edit3, Trash2, MapPin, Video, Image,
  Clock, ChevronDown, ChevronUp, Newspaper, AlertTriangle,
  AlertCircle, Calendar, ExternalLink
} from "lucide-react";
import ConfirmModal from "../components/ConfirmModal";

const categoryMeta: Record<string, { icon: typeof Newspaper; label: string; color: string; bg: string }> = {
  news: { icon: Newspaper, label: "News", color: "#34D399", bg: "rgba(16,185,129,0.15)" },
  advisory: { icon: AlertTriangle, label: "Advisory", color: "#60A5FA", bg: "rgba(37,107,235,0.15)" },
  alert: { icon: AlertCircle, label: "Alert", color: "#F87171", bg: "rgba(239,68,68,0.15)" },
  event: { icon: Calendar, label: "Event", color: "#A78BFA", bg: "rgba(139,92,246,0.15)" },
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-PH", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function formatDateFull(d: string) {
  return new Date(d).toLocaleDateString("en-PH", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function Announcements() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase.from("announcements").delete().eq("id", deleteTarget.id);
      if (error) throw error;
      setAnnouncements((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      toast("Announcement deleted successfully", "success");
    } catch (err: any) {
      toast(err.message || "Failed to delete announcement", "error");
    } finally {
      setDeleteTarget(null);
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

  const needsTruncation = (text: string) => text.length > 200;

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const visibleCount = 4;

  if (loading) {
    return (
      <div className="page-body" style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
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
        <h2>Announcements</h2>
        <button className="btn btn-gold" onClick={() => navigate("/dashboard/announcements/create")}>
          <Plus size={16} /> New Announcement
        </button>
      </div>
      <div className="page-body">
        {announcements.length > 0 ? (
          <div className="announcements-list">
          {announcements.map((a) => {
            const images = getImages(a);
            const videos = getVideos(a);
            const cat = categoryMeta[a.category] || categoryMeta.news;
            const CatIcon = cat.icon;
            const isExpanded = expandedIds.has(a.id);
            const showExpand = needsTruncation(a.content || "");

            return (
              <div key={a.id} className={`announcement-card cat-${a.category || "news"}`}>
                <div className="announcement-card-inner">
                  <div className="card-header-section">
                    <span className="cat-badge" style={{ background: cat.bg, color: cat.color }}>
                      <CatIcon size={13} /> {cat.label}
                    </span>
                  </div>
                  <div className="card-title">{a.title}</div>
                  <div className="card-meta">
                    <span className="card-meta-item">
                      <Clock size={13} />
                      <span className="meta-text">{timeAgo(a.created_at)}</span>
                    </span>
                    <span className="card-meta-sep" />
                    <span className="card-meta-item">
                      <span className="meta-text">{formatDateFull(a.created_at)}</span>
                    </span>
                  </div>
                  <div className="card-divider" />

                  <div className={`card-body${!isExpanded && showExpand ? " collapsed" : ""}`}>
                    {a.content}
                  </div>

                  {showExpand && (
                    <button className="expand-btn" onClick={() => toggleExpand(a.id)}>
                      {isExpanded ? <><ChevronUp size={14} /> Show less</> : <><ChevronDown size={14} /> Read more</>}
                    </button>
                  )}

                  {images.length > 0 && (
                    <div className={`announcement-media-grid imgs-${Math.min(images.length, 6)}`}>
                      {images.slice(0, visibleCount).map((url, i) => (
                        <div key={i} className="media-item">
                          <img src={url} alt="" loading="lazy" />
                          {i === visibleCount - 1 && images.length > visibleCount && (
                            <div className="media-overlay">+{images.length - visibleCount}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {videos.length > 0 && (
                    <div className="video-list">
                      {videos.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="video-link">
                          <span className="video-icon"><Video size={16} /></span>
                          <span style={{ flex: 1 }}>Video {videos.length > 1 ? i + 1 : ""}</span>
                          <ExternalLink size={14} />
                        </a>
                      ))}
                    </div>
                  )}

                  {a.location_name && (
                    <div className="announcement-location">
                      <MapPin size={14} />
                      {a.location_name}
                      {a.latitude && a.longitude && (
                        <span style={{ color: "var(--gray-400)", fontSize: 12 }}>
                          ({a.latitude.toFixed(4)}, {a.longitude.toFixed(4)})
                        </span>
                      )}
                    </div>
                  )}

                  <div className="card-actions">
                    <button className="btn btn-sm btn-ghost" onClick={() => navigate(`/dashboard/announcements/edit/${a.id}`)}>
                      <Edit3 size={14} /> Edit
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => setDeleteTarget(a)}>
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon"><Megaphone size={24} /></div>
            <h3>No Announcements Yet</h3>
            <p>Create your first announcement to inform residents</p>
            <button className="btn btn-gold" style={{ marginTop: 16 }} onClick={() => navigate("/dashboard/announcements/create")}>
              <Plus size={16} /> Create Announcement
            </button>
          </div>
        )}
      </div>

      {deleteTarget && (
        <ConfirmModal
          title="Delete Announcement"
          message={`Are you sure you want to delete "${deleteTarget.title}"? This action cannot be undone.`}
          confirmLabel="Delete"
          variant="danger"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}
