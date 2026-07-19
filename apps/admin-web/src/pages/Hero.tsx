import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, MapPin, LogIn } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Hero() {
  const { isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && isAdmin) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAdmin, isLoading, navigate]);

  if (isLoading) return null;
  if (isAdmin) return null;

  return (
    <div className="hero-page">
      <video
        className="hero-video"
        src="/0719.mp4"
        autoPlay
        muted
        loop
        playsInline
      />
      <div className="hero-overlay" />
      <div className="hero-content">
        <div className="hero-badge">
          <Shield size={14} />
          <span>PNP Administration</span>
        </div>

        <h1 className="hero-title">
          Ligtas
          <span className="hero-title-highlight"> Calbayog</span>
        </h1>

        <p className="hero-subtitle">
          Police Administration Portal — Real-time crime monitoring,
          patrol tracking, and emergency response management for the city of Calbayog.
        </p>

        <div className="hero-actions">
          <button className="hero-btn hero-btn-primary" onClick={() => navigate("/login")}>
            <LogIn size={18} />
            Admin Login
          </button>
        </div>

        <div className="hero-features">
          {[
            { icon: MapPin, label: "Real-Time Tracking" },
            { icon: Shield, label: "Incident Management" },
            { icon: MapPin, label: "Operations Map" },
          ].map((f, i) => (
            <div className="hero-feature" key={i}>
              <f.icon size={16} />
              <span>{f.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
