import { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabase";
import { useToast } from "../context/ToastContext";
import {
  FolderOpen, Image, FileText, ChevronLeft, ChevronRight,
  Trash2, AlertTriangle, X, HardDrive, Monitor, Trash, Maximize2, Play,
} from "lucide-react";

const ITEMS_PER_PAGE = 20;
const STORAGE_PAGE_SIZE = 200;

const SUPABASE_URL = "https://rgqmuuxmucgbxrjjxsvh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_u0FuERFW0mCtzknOQd19kA_55jVUKnx";
const BUCKET = "report-photos";

const isVideoUrl = (url: string) => /\.(mp4|webm|mov|avi)$/i.test(url);

export default function Evidence() {
  const { toast } = useToast();
  const [tab, setTab] = useState<"active" | "storage">("active");
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const [storageFiles, setStorageFiles] = useState<any[]>([]);
  const [orphanedNames, setOrphanedNames] = useState<Set<string>>(new Set());
  const [storageLoading, setStorageLoading] = useState(false);
  const [deletingFiles, setDeletingFiles] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [storagePage, setStoragePage] = useState(1);
  const [deletingAll, setDeletingAll] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Map<string, string>>(new Map());
  const [storageSignedUrls, setStorageSignedUrls] = useState<Map<string, string>>(new Map());
  const SIGNED_URL_EXPIRY = 86400;

  const getSignedUrl = useCallback(async (filename: string): Promise<string | null> => {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(filename, SIGNED_URL_EXPIRY);
    return data?.signedUrl ?? null;
  }, []);

  const loadReports = useCallback(async () => {
    const { data } = await supabase
      .from("crime_reports")
      .select("id, crime_type, description, photo_url, created_at, status, location_address")
      .not("photo_url", "is", null)
      .order("created_at", { ascending: false });
    if (data) {
      setReports(data);
      const map = new Map<string, string>();
      await Promise.all(data.map(async (r) => {
        if (!r.photo_url) return;
        const firstUrl = r.photo_url.split(",")[0].trim();
        try {
          const name = new URL(firstUrl).pathname.split("/").pop();
          if (name) {
            const signed = await getSignedUrl(name);
            if (signed) map.set(r.id, signed);
          }
        } catch {}
      }));
      setSignedUrls(map);
    }
    setLoading(false);
  }, [getSignedUrl]);

  useEffect(() => {
    const channel = supabase
      .channel("admin-evidence")
      .on("postgres_changes", { event: "*", schema: "public", table: "crime_reports" }, () => loadReports())
      .subscribe();
    loadReports();
    return () => { supabase.removeChannel(channel); };
  }, [loadReports]);

  const loadStorageFiles = useCallback(async () => {
    setStorageLoading(true);
    try {
      const { data: files, error } = await supabase.storage
        .from(BUCKET)
        .list("", { limit: STORAGE_PAGE_SIZE, sortBy: { column: "created_at", order: "desc" } });

      if (error) throw error;
      if (!files) { setStorageFiles([]); return; }

      const { data: dbReports } = await supabase
        .from("crime_reports")
        .select("photo_url");

      const usedFilenames = new Set<string>();
      if (dbReports) {
        for (const r of dbReports) {
          if (r.photo_url) {
            r.photo_url.split(",").map((u: string) => u.trim()).filter(Boolean).forEach((url: string) => {
              try {
                const name = new URL(url).pathname.split("/").pop();
                if (name) usedFilenames.add(name);
              } catch {}
            });
          }
        }
      }

      setStorageFiles(files);
      setOrphanedNames(new Set(
        files.filter((f: any) => !usedFilenames.has(f.name)).map((f: any) => f.name)
      ));

      const urlMap = new Map<string, string>();
      await Promise.all(files.map(async (f: any) => {
        const signed = await getSignedUrl(f.name);
        if (signed) urlMap.set(f.name, signed);
      }));
      setStorageSignedUrls(urlMap);
    } catch (err) {
      console.error("Failed to load storage files:", err);
    } finally {
      setStorageLoading(false);
    }
  }, [getSignedUrl]);

  useEffect(() => {
    if (tab === "storage") loadStorageFiles();
  }, [tab, loadStorageFiles]);

  const deleteFromStorage = async (filename: string): Promise<void> => {
    const { error } = await supabase.storage.from(BUCKET).remove([filename]);
    if (error) throw error;
  };

  const handleDeleteFile = async (filename: string) => {
    setDeletingFiles(prev => new Set(prev).add(filename));
    try {
      await deleteFromStorage(filename);
      setStorageFiles(prev => prev.filter(f => f.name !== filename));
      setOrphanedNames(prev => { const n = new Set(prev); n.delete(filename); return n; });
      setConfirmDelete(null);
      toast(`Deleted "${filename}"`, "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast(`Delete failed: ${msg}`, "error");
      console.error("Failed to delete file:", err);
    } finally {
      setDeletingFiles(prev => { const n = new Set(prev); n.delete(filename); return n; });
    }
  };

  const handleDeleteAllOrphaned = async () => {
    setDeletingAll(true);
    try {
      const toDelete = Array.from(orphanedNames);
      if (toDelete.length === 0) { toast("No orphaned files to delete", "info"); return; }
      let deleted = 0, errors: string[] = [];
      for (const name of toDelete) {
        try {
          await deleteFromStorage(name);
          deleted++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : JSON.stringify(err);
          errors.push(`${name}: ${msg}`);
        }
      }
      setStorageFiles(prev => prev.filter(f => !orphanedNames.has(f.name)));
      setOrphanedNames(new Set());
      if (errors.length === 0) {
        toast(`Deleted ${deleted} orphaned file${deleted !== 1 ? "s" : ""}`, "success");
      } else {
        toast(`Deleted ${deleted}, but ${errors.length} failed: ${errors[0]}`, "error");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast(`Delete failed: ${msg}`, "error");
      console.error("Failed to delete orphaned files:", err);
    } finally {
      setDeletingAll(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const totalPages = Math.ceil(reports.length / ITEMS_PER_PAGE);
  const paginated = reports.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const storageTotalPages = Math.ceil(storageFiles.length / ITEMS_PER_PAGE);
  const paginatedStorage = storageFiles.slice((storagePage - 1) * ITEMS_PER_PAGE, storagePage * ITEMS_PER_PAGE);

  if (loading) {
    return <div className="page-body"><div aria-label="Loading..." role="status" className="loader">
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
  }

  return (
    <>
      <div className="page-header">
        <h2><FolderOpen size={22} /> Evidence</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", gap: 4, background: "var(--gray-200)", borderRadius: 8, padding: 2 }}>
            <button
              onClick={() => setTab("active")}
              style={{
                padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                background: tab === "active" ? "var(--gray-100)" : "transparent",
                color: tab === "active" ? "var(--gray-900)" : "var(--gray-500)",
                border: "none", borderRadius: 6, display: "flex", alignItems: "center", gap: 5,
                transition: "all 0.15s",
              }}
            >
              <Image size={13} /> Active Evidence
            </button>
            <button
              onClick={() => setTab("storage")}
              style={{
                padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                background: tab === "storage" ? "var(--gray-100)" : "transparent",
                color: tab === "storage" ? "var(--gray-900)" : "var(--gray-500)",
                border: "none", borderRadius: 6, display: "flex", alignItems: "center", gap: 5,
                transition: "all 0.15s",
              }}
            >
              <HardDrive size={13} /> Storage Manager
            </button>
          </div>
        </div>
      </div>

      <div className="page-body">
        {tab === "active" ? (
          paginated.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><FolderOpen size={40} /></div>
              <h3>No evidence files</h3>
              <p>Photos uploaded with incident reports will appear here.</p>
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                {paginated.map((r) => (
                  <div className="card" key={r.id} style={{ overflow: "hidden" }}>
                    {r.photo_url && (
                      <div style={{ width: "100%", height: 180, overflow: "hidden", background: "var(--gray-100)" }}>
                        <img
                          src={signedUrls.get(r.id) || r.photo_url.split(",")[0].trim()}
                          alt="Evidence"
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      </div>
                    )}
                    <div className="card-body">
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <FileText size={14} />
                        <strong style={{ fontSize: 14 }}>{r.crime_type}</strong>
                      </div>
                      <p style={{ fontSize: 13, color: "var(--gray-500)", marginBottom: 8, lineClamp: 2 }}>
                        {r.description?.slice(0, 100)}...
                      </p>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "var(--gray-400)" }}>
                        <span>{r.location_address || "—"}</span>
                        <span>{new Date(r.created_at).toLocaleDateString()}</span>
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
          )
        ) : storageLoading ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 60 }}>
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
              <span className="loading-text">Loading storage files...</span>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <HardDrive size={16} style={{ color: "var(--gray-400)" }} />
                <span style={{ fontSize: 13, color: "var(--gray-500)" }}>
                  {storageFiles.length} file{storageFiles.length !== 1 ? "s" : ""} — <span style={{ color: orphanedNames.size > 0 ? "#ef4444" : "var(--gray-500)", fontWeight: 600 }}>{orphanedNames.size} orphaned</span>
                </span>
              </div>
              {orphanedNames.size > 0 && (
                <button
                  className="btn btn-sm btn-danger"
                  onClick={handleDeleteAllOrphaned}
                  disabled={deletingAll}
                  style={{ display: "flex", alignItems: "center", gap: 5 }}
                >
                  <Trash size={13} />
                  {deletingAll ? "Deleting..." : `Delete All Orphaned (${orphanedNames.size})`}
                </button>
              )}
            </div>

            {storageFiles.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon"><HardDrive size={40} /></div>
                <h3>Storage is empty</h3>
                <p>No files found in the storage bucket.</p>
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Preview</th>
                      <th>Filename</th>
                      <th>Size</th>
                      <th>Status</th>
                      <th>Upload Date</th>
                      <th style={{ width: 60 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedStorage.map((f: any) => {
                      const isOrphaned = orphanedNames.has(f.name);
                      const isDeleting = deletingFiles.has(f.name);
                      const fileUrl = storageSignedUrls.get(f.name) || `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${f.name}`;
                      const mime = f.metadata?.mimetype || "";
                      const isImage = mime.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp)$/i.test(f.name);
                      const isVideo = mime.startsWith("video/") || /\.(mp4|webm|mov|avi)$/i.test(f.name);
                      const canPreview = isImage || isVideo;
                      return (
                        <tr key={f.id || f.name} style={{ opacity: isDeleting ? 0.5 : 1 }}>
                          <td>
                            <div
                              onClick={() => {
                                if (!canPreview) return;
                                setPreviewLoading(true);
                                if (isVideo) { requestAnimationFrame(() => setPreviewUrl(fileUrl)); return; }
                                requestAnimationFrame(() => {
                                  const preload = new Image();
                                  preload.onload = () => {
                                    preload.decode().then(() => {
                                      setPreviewUrl(fileUrl);
                                      setPreviewLoading(false);
                                    });
                                  };
                                  preload.onerror = () => { setPreviewUrl(fileUrl); setPreviewLoading(false); };
                                  preload.src = fileUrl;
                                });
                              }}
                              style={{
                                width: 48, height: 48, borderRadius: 6, overflow: "hidden",
                                background: "var(--gray-200)", display: "flex",
                                alignItems: "center", justifyContent: "center",
                                cursor: canPreview ? "pointer" : "default",
                                position: "relative",
                              }}
                            >
                              {isImage ? (
                                <>
                                  <img src={fileUrl} alt=""
                                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                  <div style={{
                                    position: "absolute", inset: 0,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    background: "rgba(0,0,0,0.3)", opacity: 0,
                                    transition: "opacity 0.15s",
                                  }}
                                    onMouseOver={(e) => e.currentTarget.style.opacity = "1"}
                                    onMouseOut={(e) => e.currentTarget.style.opacity = "0"}
                                  >
                                    <Maximize2 size={14} color="#fff" />
                                  </div>
                                </>
                              ) : isVideo ? (
                                <>
                                  <video src={fileUrl} muted playsInline preload="metadata"
                                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                    onError={(e) => { (e.target as HTMLElement).style.display = "none"; }} />
                                  <div style={{
                                    position: "absolute", inset: 0,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    background: "rgba(0,0,0,0.3)",
                                  }}>
                                    <Play size={14} color="#fff" />
                                  </div>
                                </>
                              ) : (
                                <Monitor size={18} style={{ color: "var(--gray-400)" }} />
                              )}
                            </div>
                          </td>
                          <td style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "var(--font-mono)", fontSize: 12 }}>
                            {f.name}
                          </td>
                          <td style={{ fontSize: 12, color: "var(--gray-400)" }}>
                            {f.metadata?.size ? formatFileSize(f.metadata.size) : "—"}
                          </td>
                          <td>
                            <span style={{
                              display: "inline-flex", alignItems: "center", gap: 4,
                              padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700,
                              background: isOrphaned ? "rgba(239,68,68,0.12)" : "rgba(16,185,129,0.12)",
                              color: isOrphaned ? "#ef4444" : "#10b981",
                            }}>
                              {isOrphaned ? "Orphaned" : "Active"}
                            </span>
                          </td>
                          <td style={{ fontSize: 12, color: "var(--gray-400)" }}>
                            {f.created_at ? new Date(f.created_at).toLocaleDateString() : "—"}
                          </td>
                          <td>
                            <button
                              onClick={() => setConfirmDelete(f.name)}
                              disabled={isDeleting}
                              title="Delete file"
                              style={{
                                background: "none", border: "none", cursor: "pointer",
                                color: "var(--gray-400)", padding: 4, borderRadius: 4,
                                transition: "color 0.15s",
                              }}
                              onMouseOver={(e) => (e.currentTarget.style.color = "#ef4444")}
                              onMouseOut={(e) => (e.currentTarget.style.color = "var(--gray-400)")}
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {storageTotalPages > 1 && (
              <div className="pagination" style={{ marginTop: 16 }}>
                <button className="btn-ghost" disabled={storagePage === 1} onClick={() => setStoragePage(storagePage - 1)}>
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: storageTotalPages }, (_, i) => (
                  <button key={i + 1} className={storagePage === i + 1 ? "btn-primary" : "btn-ghost"} onClick={() => setStoragePage(i + 1)}>
                    {i + 1}
                  </button>
                ))}
                <button className="btn-ghost" disabled={storagePage === storageTotalPages} onClick={() => setStoragePage(storagePage + 1)}>
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {(previewUrl || previewLoading) && (
        <div className="rd-lightbox" onClick={() => { setPreviewUrl(null); setPreviewLoading(false); }}>
          <button className="rd-lb-close" onClick={() => { setPreviewUrl(null); setPreviewLoading(false); }}>
            <X size={22} />
          </button>
          {previewLoading && (
            <div style={{
              position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
              color: "#fff", fontSize: 14, display: "flex", flexDirection: "column",
              alignItems: "center", gap: 10,
            }}>
              <div aria-label="Loading..." role="status" className="loader" style={{ "--loader-color": "#fff" } as React.CSSProperties}>
                <svg className="icon" viewBox="0 0 256 256">
                  <line x1="128" y1="32" x2="128" y2="64" strokeLinecap="round" strokeLinejoin="round" strokeWidth="24"></line>
                  <line x1="195.9" y1="60.1" x2="173.3" y2="82.7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="24"></line>
                  <line x1="224" y1="128" x2="192" y2="128" strokeLinecap="round" strokeLinejoin="round" strokeWidth="24"></line>
                  <line x1="195.9" y1="195.9" x2="173.3" y2="173.3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="24"></line>
                  <line x1="128" y1="224" x2="128" y2="192" strokeLinecap="round" strokeLinejoin="round" strokeWidth="24"></line>
                  <line x1="60.1" y1="195.9" x2="82.7" y2="173.3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="24"></line>
                  <line x1="32" y1="128" x2="64" y2="128" strokeLinecap="round" strokeLinejoin="round" strokeWidth="24"></line>
                  <line x1="60.1" y1="60.1" x2="82.7" y2="82.7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="24"></line>
                </svg>
              </div>
              Loading...
            </div>
          )}
          {isVideoUrl(previewUrl) ? (
            <video className="rd-lb-img" src={previewUrl} controls autoPlay
              onClick={(e) => e.stopPropagation()}
              onLoadedData={() => setPreviewLoading(false)}
              onError={() => setPreviewLoading(false)}
              style={{ display: previewLoading ? "none" : "block" }} />
          ) : (
            <img className="rd-lb-img" src={previewUrl} alt="" onClick={(e) => e.stopPropagation()} />
          )}
        </div>
      )}

      {confirmDelete && (
        <>
          <div
            onClick={() => setConfirmDelete(null)}
            style={{
              position: "fixed", inset: 0, zIndex: 9998,
              background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
              animation: "fadeIn 0.2s ease-out",
            }}
          />
          <div
            style={{
              position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
              zIndex: 9999, width: 360, maxWidth: "90vw",
              background: "var(--gray-100)", borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
              animation: "alertSlideIn 0.3s cubic-bezier(0.16,1,0.3,1)",
              overflow: "hidden",
            }}
          >
            <div style={{
              padding: "24px 24px 0",
              display: "flex", alignItems: "flex-start", gap: 14,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: "rgba(239,68,68,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <AlertTriangle size={22} color="#ef4444" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--gray-900)", marginBottom: 4 }}>
                  Delete File
                </div>
                <div style={{ fontSize: 13, color: "var(--gray-500)", lineHeight: 1.5, wordBreak: "break-all" }}>
                  Are you sure you want to delete <strong style={{ color: "var(--gray-700)" }}>{confirmDelete}</strong>? This cannot be undone.
                </div>
              </div>
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deletingFiles.has(confirmDelete)}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--gray-500)", padding: 2, lineHeight: 0,
                }}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: "20px 24px", display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deletingFiles.has(confirmDelete)}
                style={{
                  padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  background: "transparent", color: "var(--gray-500)",
                  border: "1px solid var(--gray-300)", borderRadius: 8,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteFile(confirmDelete)}
                disabled={deletingFiles.has(confirmDelete)}
                style={{
                  padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  background: "#ef4444", color: "#fff",
                  border: "none", borderRadius: 8,
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                <Trash2 size={15} />
                {deletingFiles.has(confirmDelete) ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
