import { useState, useEffect, useRef } from "react";
import { Settings as SettingsIcon, Save, Bell, Shield, Globe, MapPin, Sun, Moon, Camera, Key, Eye, EyeOff } from "lucide-react";
import { supabase } from "../supabase";

function getTheme(): "light" | "dark" {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("admin-theme");
    if (stored === "light" || stored === "dark") return stored;
  }
  return "dark";
}

function setTheme(mode: "light" | "dark") {
  document.documentElement.setAttribute("data-theme", mode);
  localStorage.setItem("admin-theme", mode);
}

const SETTINGS_SECTIONS = [
  {
    id: "profile",
    label: "Station Profile",
    icon: Camera,
    fields: [],
  },
  {
    id: "general",
    label: "General",
    icon: Globe,
    fields: [
      { label: "System Name", value: "Ligtas Calbayog", type: "text" },
      { label: "Contact Email", value: "admin@ligtascalbayog.gov.ph", type: "email" },
      { label: "Contact Phone", value: "(055) 123-4567", type: "text" },
    ],
  },
  {
    id: "theme",
    label: "Theme",
    icon: Sun,
    fields: [],
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: Bell,
    fields: [
      { label: "Email Alerts", value: "Enabled", type: "toggle" },
      { label: "SMS Alerts", value: "Enabled", type: "toggle" },
      { label: "Real-time Updates", value: "Enabled", type: "toggle" },
    ],
  },
  {
    id: "security",
    label: "Security",
    icon: Shield,
    fields: [
      { label: "Session Timeout", value: "30 minutes", type: "text" },
      { label: "Two-Factor Auth", value: "Disabled", type: "toggle" },
      { label: "Password Policy", value: "Strong", type: "text" },
    ],
  },
  {
    id: "password",
    label: "Change Password",
    icon: Key,
    fields: [],
  },
  {
    id: "maps",
    label: "Map Configuration",
    icon: MapPin,
    fields: [
      { label: "Default Latitude", value: "12.07", type: "text" },
      { label: "Default Longitude", value: "124.6", type: "text" },
      { label: "Default Zoom", value: "11", type: "text" },
      { label: "Map Style", value: "Dark Matter", type: "text" },
    ],
  },
];

const BUCKET = "profile-photos";
const STORAGE_PATH = "station-profile/profile.png";

export default function Settings() {
  const [activeSection, setActiveSection] = useState("general");
  const [saved, setSaved] = useState(false);
  const [theme, setThemeState] = useState<"light" | "dark">(getTheme);
  const [stationName, setStationName] = useState("PNP Calbayog");
  const [policePhone, setPolicePhone] = useState("117");
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    setTheme(theme);
  }, [theme]);

  useEffect(() => {
    loadStationSettings();
  }, []);

  const loadStationSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("station_settings")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Failed to load station settings:", error.message);
        return;
      }
      if (data) {
        setStationName(data.station_name || "PNP Calbayog");
        setPolicePhone(data.police_phone || "117");
        setProfileImage(data.profile_image_url || null);
      }
    } catch (err: any) {
      console.error("loadStationSettings error:", err.message);
    }
  };

  const toggleTheme = () => {
    setThemeState((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError("");

    try {
      // Convert file to ArrayBuffer for reliable upload
      const arrayBuffer = await file.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(STORAGE_PATH, arrayBuffer, {
          contentType: file.type || "image/png",
          upsert: true,
        });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        throw new Error(uploadError.message || "Storage upload failed");
      }

      // Build public URL with cache buster
      const { data: urlData } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(STORAGE_PATH);

      const publicUrl = urlData?.publicUrl;
      if (!publicUrl) {
        throw new Error("Failed to get public URL");
      }

      const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`;

      // Save to station_settings table
      const { data: existing } = await supabase
        .from("station_settings")
        .select("id")
        .limit(1)
        .maybeSingle();

      if (existing) {
        const { error: updateError } = await supabase
          .from("station_settings")
          .update({ profile_image_url: cacheBustedUrl, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (updateError) {
          console.error("Update error:", updateError);
          throw new Error(updateError.message || "Failed to save settings");
        }
      } else {
        const { error: insertError } = await supabase
          .from("station_settings")
          .insert({ station_name: stationName, profile_image_url: cacheBustedUrl });
        if (insertError) {
          console.error("Insert error:", insertError);
          throw new Error(insertError.message || "Failed to create settings");
        }
      }

      setProfileImage(cacheBustedUrl);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      console.error("Upload failed:", err);
      setUploadError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    try {
      const { data: existing } = await supabase
        .from("station_settings")
        .select("id")
        .limit(1)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("station_settings")
          .update({ station_name: stationName, police_phone: policePhone, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("station_settings")
          .insert({ station_name: stationName, police_phone: policePhone, profile_image_url: profileImage });
        if (error) throw error;
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      console.error("Save failed:", err.message);
      alert("Failed to save: " + err.message);
    }
  };

  const handleChangePassword = async () => {
    setPasswordMsg(null);

    if (!newPassword || !confirmPassword) {
      setPasswordMsg({ type: "error", text: "All fields are required." });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ type: "error", text: "New password must be at least 6 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: "error", text: "New password and confirmation do not match." });
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setPasswordMsg({ type: "error", text: error.message });
        return;
      }

      setPasswordMsg({ type: "success", text: "Password changed successfully!" });
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordMsg({ type: "error", text: err.message || "Failed to change password." });
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <h2><SettingsIcon size={22} /> Settings</h2>
        <button className="btn-primary" onClick={handleSave} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Save size={16} /> {saved ? "Saved!" : "Save Changes"}
        </button>
      </div>
      <div className="page-body">
        <div style={{ display: "flex", gap: 24 }}>
          <div style={{ width: 220, flexShrink: 0 }}>
            <div className="card" style={{ padding: 0 }}>
              {SETTINGS_SECTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, width: "100%",
                    padding: "12px 16px", border: "none", background: "transparent",
                    fontSize: 14, textAlign: "left", cursor: "pointer",
                    borderBottom: "1px solid var(--gray-100)",
                    color: activeSection === s.id ? "var(--gold)" : "var(--gray-600)",
                    fontWeight: activeSection === s.id ? 600 : 400,
                  }}
                >
                  <s.icon size={16} />
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1 }}>
            {activeSection === "profile" && (
              <div className="card">
                <div className="card-header">
                  <h3 style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--gray-900)" }}>
                    <Camera size={18} /> Station Profile
                  </h3>
                </div>
                <div className="card-body">
                  <p style={{ fontSize: 13, color: "var(--gray-500)", marginBottom: 20 }}>
                    This profile will be displayed on all announcement cards in the resident app.
                  </p>

                  <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 24 }}>
                    <div
                      style={{
                        width: 100, height: 100, borderRadius: "50%",
                        background: "var(--gray-100)", border: "3px dashed var(--gray-300)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        overflow: "hidden", flexShrink: 0, cursor: "pointer",
                      }}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {profileImage ? (
                        <img
                          src={profileImage}
                          alt="Station Profile"
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <Camera size={32} color="var(--gray-400)" />
                      )}
                    </div>
                    <div>
                      <button
                        className="btn-primary"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        style={{ marginBottom: 8 }}
                      >
                        {uploading ? "Uploading..." : profileImage ? "Change Photo" : "Upload Photo"}
                      </button>
                      {uploadError && (
                        <div style={{ fontSize: 12, color: "#EF4444", marginBottom: 4 }}>
                          {uploadError}
                        </div>
                      )}
                      <div style={{ fontSize: 12, color: "var(--gray-500)" }}>
                        Recommended: 200x200px, JPG or PNG
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={handleImageUpload}
                      />
                    </div>
                  </div>

                  <div style={{ borderTop: "1px solid var(--gray-100)", paddingTop: 16 }}>
                    <label style={{ fontSize: 14, fontWeight: 500, display: "block", marginBottom: 8, color: "var(--gray-800)" }}>
                      Station Name
                    </label>
                    <input
                      type="text"
                      value={stationName}
                      onChange={(e) => setStationName(e.target.value)}
                      style={{
                        width: "100%", padding: "10px 14px", fontSize: 14,
                        border: "1.5px solid var(--gray-300)", borderRadius: "var(--radius-md)",
                        background: "transparent", color: "var(--gray-700)",
                      }}
                    />
                    <div style={{ fontSize: 12, color: "var(--gray-500)", marginTop: 6 }}>
                      This name appears on every announcement card in the resident app.
                    </div>
                  </div>

                  <div style={{ borderTop: "1px solid var(--gray-100)", paddingTop: 16, marginTop: 16 }}>
                    <label style={{ fontSize: 14, fontWeight: 500, display: "block", marginBottom: 8, color: "var(--gray-800)" }}>
                      Emergency Phone Number
                    </label>
                    <input
                      type="text"
                      value={policePhone}
                      onChange={(e) => setPolicePhone(e.target.value)}
                      style={{
                        width: "100%", padding: "10px 14px", fontSize: 14,
                        border: "1.5px solid var(--gray-300)", borderRadius: "var(--radius-md)",
                        background: "transparent", color: "var(--gray-700)",
                      }}
                    />
                    <div style={{ fontSize: 12, color: "var(--gray-500)", marginTop: 6 }}>
                      This number appears on the messages screen PNP card for emergency calls.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === "password" && (
              <div className="card">
                <div className="card-header">
                  <h3 style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--gray-900)" }}>
                    <Key size={18} /> Change Password
                  </h3>
                </div>
                <div className="card-body">
                  <p style={{ fontSize: 13, color: "var(--gray-500)", marginBottom: 20 }}>
                    You are logged in. Choose a new password below.
                  </p>

                  {passwordMsg && (
                    <div style={{
                      padding: "10px 14px", borderRadius: "var(--radius-md)", marginBottom: 16,
                      fontSize: 13, fontWeight: 500,
                      background: passwordMsg.type === "success" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                      color: passwordMsg.type === "success" ? "#10b981" : "#ef4444",
                      border: `1px solid ${passwordMsg.type === "success" ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
                    }}>
                      {passwordMsg.text}
                    </div>
                  )}

                  <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 400 }}>
                    <div>
                      <label style={{ fontSize: 14, fontWeight: 500, display: "block", marginBottom: 8, color: "var(--gray-800)" }}>
                        New Password
                      </label>
                      <div style={{ position: "relative" }}>
                        <input
                          type={showNewPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Enter new password"
                          style={{
                            width: "100%", padding: "10px 40px 10px 14px", fontSize: 14,
                            border: "1.5px solid var(--gray-300)", borderRadius: "var(--radius-md)",
                            background: "transparent", color: "var(--gray-700)",
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          style={{
                            position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                            background: "none", border: "none", cursor: "pointer",
                            color: "var(--gray-500)", padding: 4, display: "flex",
                          }}
                        >
                          {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: 14, fontWeight: 500, display: "block", marginBottom: 8, color: "var(--gray-800)" }}>
                        Confirm New Password
                      </label>
                      <div style={{ position: "relative" }}>
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirm new password"
                          style={{
                            width: "100%", padding: "10px 40px 10px 14px", fontSize: 14,
                            border: "1.5px solid var(--gray-300)", borderRadius: "var(--radius-md)",
                            background: "transparent", color: "var(--gray-700)",
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          style={{
                            position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                            background: "none", border: "none", cursor: "pointer",
                            color: "var(--gray-500)", padding: 4, display: "flex",
                          }}
                        >
                          {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <button
                        className="btn-primary"
                        onClick={handleChangePassword}
                        disabled={changingPassword}
                        style={{ display: "flex", alignItems: "center", gap: 6 }}
                      >
                        <Key size={16} /> {changingPassword ? "Changing..." : "Change Password"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {SETTINGS_SECTIONS.filter((s) => s.id === activeSection && s.id !== "profile").map((section) => (
              <div className="card" key={section.id}>
                <div className="card-header">
                  <h3 style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--gray-900)" }}>
                    <section.icon size={18} /> {section.label}
                  </h3>
                </div>
                <div className="card-body">
                  {section.id === "theme" ? (
                    <div style={{ padding: "12px 0" }}>
                      <div style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        marginBottom: 16,
                      }}>
                        <span style={{ fontSize: 14, fontWeight: 500, color: "var(--gray-800)" }}>Appearance</span>
                        <span style={{ fontSize: 13, color: "var(--gray-500)" }}>
                          {theme === "dark" ? "Dark Mode" : "Light Mode"}
                        </span>
                      </div>
                      <button
                        onClick={toggleTheme}
                        style={{
                          display: "flex", alignItems: "center", gap: 12, width: "100%",
                          padding: "12px 16px", border: "1.5px solid var(--gray-300)",
                          borderRadius: "var(--radius-md)", background: "transparent",
                          cursor: "pointer", fontSize: 14, color: "var(--gray-700)",
                        }}
                      >
                        <div style={{
                          width: 40, height: 40, borderRadius: "var(--radius-sm)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: theme === "dark" ? "var(--navy)" : "var(--gray-200)",
                          color: theme === "dark" ? "var(--gold)" : "var(--gray-700)",
                        }}>
                          {theme === "dark" ? <Moon size={20} /> : <Sun size={20} />}
                        </div>
                        <div style={{ textAlign: "left" }}>
                          <div style={{ fontWeight: 600, marginBottom: 2, color: "var(--gray-800)" }}>
                            {theme === "dark" ? "Dark Mode" : "Light Mode"}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--gray-500)" }}>
                            {theme === "dark"
                              ? "Dark background with light text"
                              : "Light background with dark text"}
                          </div>
                        </div>
                      </button>
                    </div>
                  ) : (
                    section.fields.map((field) => (
                      <div key={field.label} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "12px 0", borderBottom: "1px solid var(--gray-100)"
                      }}>
                        <span style={{ fontSize: 14, fontWeight: 500, color: "var(--gray-800)" }}>{field.label}</span>
                        {field.type === "toggle" ? (
                          <span className="badge badge-resolved" style={{ cursor: "pointer" }}>{field.value}</span>
                        ) : (
                          <span style={{ fontSize: 14, color: "var(--gray-500)" }}>{field.value}</span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
