import { useState } from "react";
import { Settings as SettingsIcon, Save, Bell, Shield, Globe, MapPin, Users } from "lucide-react";

const SETTINGS_SECTIONS = [
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

export default function Settings() {
  const [activeSection, setActiveSection] = useState("general");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
            {SETTINGS_SECTIONS.filter((s) => s.id === activeSection).map((section) => (
              <div className="card" key={section.id}>
                <div className="card-header">
                  <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <section.icon size={18} /> {section.label}
                  </h3>
                </div>
                <div className="card-body">
                  {section.fields.map((field) => (
                    <div key={field.label} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "12px 0", borderBottom: "1px solid var(--gray-100)"
                    }}>
                      <span style={{ fontSize: 14, fontWeight: 500 }}>{field.label}</span>
                      {field.type === "toggle" ? (
                        <span className="badge badge-resolved" style={{ cursor: "pointer" }}>{field.value}</span>
                      ) : (
                        <span style={{ fontSize: 14, color: "var(--gray-500)" }}>{field.value}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
