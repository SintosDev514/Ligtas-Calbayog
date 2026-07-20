import { useState, useEffect, useRef, FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../supabase";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { ArrowLeft, Image, Plus, MapPin, Save, X } from "lucide-react";

export default function CreateAnnouncement() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const isEditing = !!id;

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("news");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  const [videoUrls, setVideoUrls] = useState<string[]>([""]);
  const [locationName, setLocationName] = useState<string>("");
  const [latitude, setLatitude] = useState<string>("");
  const [longitude, setLongitude] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [useMapPicker, setUseMapPicker] = useState(false);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && id) {
      loadAnnouncement(id);
    }
  }, [id]);

  const loadAnnouncement = async (announcementId: string) => {
    try {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .eq("id", announcementId)
        .single();
      if (error) throw error;
      if (data) {
        setTitle(data.title);
        setContent(data.content || "");
        setCategory(data.category || "news");
        const imgs = data.image_urls || (data.image_url ? [data.image_url] : []);
        setExistingImageUrls(imgs);
        const vids = data.video_urls || (data.video_url ? [data.video_url] : []);
        setVideoUrls(vids.length ? vids : [""]);
        setLocationName(data.location_name || "");
        setLatitude(data.latitude?.toString() || "");
        setLongitude(data.longitude?.toString() || "");
      }
    } catch (err: any) {
      setError("Failed to load announcement");
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newPreviews: string[] = [];
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      newPreviews.push(URL.createObjectURL(file));
    }
    setImageFiles((prev) => [...prev, ...files]);
    setImagePreviews((prev) => [...prev, ...newPreviews]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeNewImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const removeExistingImage = (index: number) => {
    setExistingImageUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const addVideoField = () => setVideoUrls((prev) => [...prev, ""]);
  const removeVideoField = (index: number) =>
    setVideoUrls((prev) => prev.filter((_, i) => i !== index));
  const updateVideoUrl = (index: number, value: string) =>
    setVideoUrls((prev) => prev.map((v, i) => (i === index ? value : v)));

  const initMapPicker = () => {
    setUseMapPicker(true);
    setTimeout(() => {
      import("maplibre-gl").then((maplibregl) => {
        const container = document.getElementById("location-picker-map");
        if (!container) return;
        const lng = longitude ? parseFloat(longitude) : 124.6;
        const lat = latitude ? parseFloat(latitude) : 12.066;

        const map = new maplibregl.Map({
          container,
          style: "https://tiles.openfreemap.org/styles/liberty",
          center: [lng, lat],
          zoom: 13,
        });

        map.addControl(new maplibregl.NavigationControl(), "top-right");

        const marker = new maplibregl.Marker({ draggable: true, color: "#DC2626" })
          .setLngLat([lng, lat])
          .addTo(map);

        marker.on("dragend", () => {
          const lngLat = marker.getLngLat();
          setLatitude(lngLat.lat.toFixed(6));
          setLongitude(lngLat.lng.toFixed(6));
        });

        map.on("click", (e: any) => {
          marker.setLngLat(e.lngLat);
          setLatitude(e.lngLat.lat.toFixed(6));
          setLongitude(e.lngLat.lng.toFixed(6));
        });

        mapRef.current = map;
        markerRef.current = marker;
      });
    }, 100);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    setSubmitting(true);

    try {
      const uploadedUrls: string[] = [];

      for (const file of imageFiles) {
        const ext = file.name.split(".").pop() || "jpg";
        const filename = `announcement-${user?.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("report-photos")
          .upload(filename, file, { contentType: file.type, upsert: true });
        if (uploadError) throw new Error("Image upload failed: " + uploadError.message);
        const { data: urlData } = supabase.storage
          .from("report-photos")
          .getPublicUrl(filename);
        uploadedUrls.push(urlData.publicUrl);
      }

      const allImageUrls = [...existingImageUrls, ...uploadedUrls];
      const filteredVideos = videoUrls.map((v) => v.trim()).filter(Boolean);

      const payload: any = {
        title: title.trim(),
        content: content.trim(),
        category,
        updated_at: new Date().toISOString(),
        image_urls: allImageUrls,
        video_urls: filteredVideos,
      };

      if (allImageUrls.length > 0) payload.image_url = allImageUrls[0];
      else payload.image_url = null;
      if (filteredVideos.length > 0) payload.video_url = filteredVideos[0];
      else payload.video_url = null;

      const trimmedLocation = locationName.trim();
      if (trimmedLocation) payload.location_name = trimmedLocation;
      else if (isEditing) payload.location_name = null;
      if (latitude) payload.latitude = parseFloat(latitude);
      else if (isEditing) payload.latitude = null;
      if (longitude) payload.longitude = parseFloat(longitude);
      else if (isEditing) payload.longitude = null;
      if (user?.id && !isEditing) payload.admin_id = user.id;

      if (isEditing) {
        const { error: updateError } = await supabase
          .from("announcements")
          .update(payload)
          .eq("id", id);
        if (updateError) throw new Error("Update failed: " + updateError.message);
        toast("Announcement updated", "success");
      } else {
        payload.created_at = new Date().toISOString();
        const { error: insertError } = await supabase
          .from("announcements")
          .insert(payload);
        if (insertError) throw new Error("Create failed: " + insertError.message);
        toast("Announcement published", "success");
      }

      navigate("/dashboard/announcements");
    } catch (err: any) {
      setError(err.message || "Failed to save announcement");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="btn btn-sm btn-outline" onClick={() => navigate("/dashboard/announcements")}>
            <ArrowLeft size={16} /> Back
          </button>
          <h2>{isEditing ? "Edit Announcement" : "Create Announcement"}</h2>
        </div>
      </div>
      <div className="page-body">
        <div className="card" style={{ maxWidth: 800 }}>
          {error && <div className="form-error"><X size={16} /> {error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Title *</label>
              <input className="form-input" placeholder="Announcement title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Category</label>
                <select className="form-input" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="news">News</option>
                  <option value="advisory">Advisory</option>
                  <option value="alert">Alert</option>
                  <option value="event">Event</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Content</label>
              <textarea className="form-input" placeholder="Write the announcement content here..." value={content} onChange={(e) => setContent(e.target.value)} rows={6} />
            </div>

            <div className="form-group">
              <label>Images</label>
              <label className="file-upload-btn">
                <Image size={16} /> Add Images
                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageSelect} />
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                {existingImageUrls.map((url, i) => (
                  <div key={`exist-${i}`} className="image-preview">
                    <img src={url} alt="" />
                    <button type="button" className="remove-image" onClick={() => removeExistingImage(i)}><X size={12} /></button>
                  </div>
                ))}
                {imagePreviews.map((preview, i) => (
                  <div key={`new-${i}`} className="image-preview">
                    <img src={preview} alt="" />
                    <button type="button" className="remove-image" onClick={() => removeNewImage(i)}><X size={12} /></button>
                  </div>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Video URLs</label>
              {videoUrls.map((url, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <input
                    className="form-input"
                    placeholder="Video URL (YouTube, direct video link, etc.)"
                    value={url}
                    onChange={(e) => updateVideoUrl(i, e.target.value)}
                    style={{ flex: 1 }}
                  />
                  {videoUrls.length > 1 && (
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => removeVideoField(i)}><X size={16} /></button>
                  )}
                </div>
              ))}
              <button type="button" className="btn btn-sm btn-outline" onClick={addVideoField}>
                <Plus size={14} /> Add Another Video
              </button>
            </div>

            <div className="form-group">
              <label>Location (Optional)</label>
              <input className="form-input" placeholder="Location name (e.g., Calbayog City Hall)" value={locationName} onChange={(e) => setLocationName(e.target.value)} style={{ marginBottom: 8 }} />
              <div className="form-row">
                <div className="form-group">
                  <label>Latitude</label>
                  <input className="form-input" placeholder="12.066" value={latitude} onChange={(e) => setLatitude(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Longitude</label>
                  <input className="form-input" placeholder="124.6" value={longitude} onChange={(e) => setLongitude(e.target.value)} />
                </div>
              </div>
              {!useMapPicker ? (
                <button type="button" className="btn btn-sm btn-outline" onClick={initMapPicker} style={{ marginTop: 4 }}>
                  <MapPin size={14} /> Pick from Map
                </button>
              ) : (
                <div id="location-picker-map" className="location-picker-map" />
              )}
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 28 }}>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                <Save size={16} />
                {submitting ? "Saving..." : isEditing ? "Update Announcement" : "Publish Announcement"}
              </button>
              <button type="button" className="btn btn-outline" onClick={() => navigate("/dashboard/announcements")}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
