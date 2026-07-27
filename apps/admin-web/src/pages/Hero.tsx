import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shield,
  Radio,
  ShieldCheck,
  LogIn,
  ArrowRight,
  Eye,
  MapPin,
  Users,
  BarChart3,
  AlertTriangle,
  Clock,
  Activity,
} from "lucide-react";
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
    <div className="hp">
      {/* Full-screen background */}
      <div className="hp-3d">
        <img
          src="/calbayog-satilite.png"
          alt="Calbayog Satellite"
          className="hp-bg-img"
        />
      </div>

      {/* Gradient overlays */}
      <div className="hp-grad-left" />
      <div className="hp-grad-bottom" />

      {/* Top bar */}
      <header className="hp-topbar">
        <div className="hp-topbar-brand">
          <img src="/logo-police.png" alt="PNP Logo" className="hp-topbar-logo" />
          <div className="hp-topbar-brand-text">
            <span className="hp-topbar-name">Ligtas Calbayog</span>
            <span className="hp-topbar-sub">PNP Command Center</span>
          </div>
        </div>
        <button className="hp-topbar-login" onClick={() => navigate("/login")}>
          <LogIn size={15} />
          Admin Login
        </button>
      </header>

      {/* Main content — bottom-left anchored */}
      <div className="hp-main">
        <div className="hp-glass">
          {/* Tagline chip */}
          <div className="hp-chip">
            <Activity size={12} />
            Emergency Response Command System
          </div>

          <h1 className="hp-headline">
            <span className="hp-headline-thin">Ligtas</span>
            <br />
            <span className="hp-headline-bold">Calbayog</span>
          </h1>

          <p className="hp-desc">
            A cross-platform emergency response and incident reporting system
            built for Calbayog City. One app for residents to report concerns,
            one for police patrols to respond in real-time, and a web command
            center for administrators — all working together to keep every
            barangay safe.
          </p>

          {/* CTA Row */}
          <div className="hp-cta-row">
            <button className="hp-cta" onClick={() => window.open("https://play.google.com/store/apps/details?id=com.ligtascalbayog", "_blank")}>
              <span>Download Resident App — Ligtas Calbayog</span>
              <ArrowRight size={16} />
            </button>
          </div>

          {/* Mini stat cards */}
          <div className="hp-mini-stats">
            <div className="hp-mini-stat">
              <div className="hp-mini-stat-icon hp-mini-stat-icon--red">
                <AlertTriangle size={14} />
              </div>
              <div>
                <span className="hp-mini-stat-val">Live</span>
                <span className="hp-mini-stat-label">Alert System</span>
              </div>
            </div>
            <div className="hp-mini-stat">
              <div className="hp-mini-stat-icon hp-mini-stat-icon--blue">
                <MapPin size={14} />
              </div>
              <div>
                <span className="hp-mini-stat-val">GPS</span>
                <span className="hp-mini-stat-label">Patrol Tracking</span>
              </div>
            </div>
            <div className="hp-mini-stat">
              <div className="hp-mini-stat-icon hp-mini-stat-icon--green">
                <ShieldCheck size={14} />
              </div>
              <div>
                <span className="hp-mini-stat-val">Verified</span>
                <span className="hp-mini-stat-label">Report Handling</span>
              </div>
            </div>
          </div>
        </div>

        {/* Feature strip on the right edge of glass */}
        <div className="hp-features">
          {[
            { icon: Radio, label: "Real-Time Dispatch", color: "#3b82f6" },
            { icon: Eye, label: "Crime Heatmaps", color: "#8b5cf6" },
            { icon: Users, label: "Officer Management", color: "#10b981" },
            { icon: BarChart3, label: "Performance Analytics", color: "#f59e0b" },
            { icon: Clock, label: "Response Time Tracking", color: "#ef4444" },
            { icon: Shield, label: "Case Resolution", color: "#06b6d4" },
          ].map((f, i) => (
            <div className="hp-feat" key={i}>
              <div
                className="hp-feat-dot"
                style={{ background: f.color, boxShadow: `0 0 8px ${f.color}60` }}
              />
              <f.icon size={13} style={{ color: f.color }} />
              <span>{f.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom status bar */}
      <footer className="hp-footer">
        <div className="hp-footer-left">
          <span className="hp-footer-dot" />
          System Operational
        </div>
        <span className="hp-footer-right">
          PNP Calbayog — Administrative Portal v1.0
        </span>
      </footer>
    </div>
  );
}
