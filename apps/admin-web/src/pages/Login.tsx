import { useState, FormEvent, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useAuth } from "../context/AuthContext";
import {
  Mail,
  Lock,
  LogIn,
  AlertCircle,
  Eye,
  EyeOff,
  ArrowLeft,
} from "lucide-react";

gsap.registerPlugin(useGSAP);

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useGSAP(
    () => {
      gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
        tl.fromTo(
          ".login-brand",
          { y: -20, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.6 }
        )
          .fromTo(
            ".login-card",
            { y: 44, opacity: 0, scale: 0.96 },
            { y: 0, opacity: 1, scale: 1, duration: 0.75 },
            "-=0.3"
          )
          .fromTo(
            ".login-logo",
            { scale: 0.8, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.4 },
            "-=0.4"
          )
          .fromTo(
            ".login-title",
            { y: 16, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.45 },
            "-=0.25"
          )
          .fromTo(
            ".login-subtitle",
            { y: 12, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.4 },
            "-=0.25"
          )
          .fromTo(
            ".login-field",
            { y: 16, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.45, stagger: 0.09 },
            "-=0.25"
          )
          .fromTo(
            ".login-btn",
            { y: 16, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.45 },
            "-=0.2"
          )
          .fromTo(
            ".login-footer",
            { opacity: 0 },
            { opacity: 1, duration: 0.5 },
            "-=0.2"
          );
      });
    },
    { scope: rootRef }
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }
    setLoading(true);
    try {
      await signIn(email, password);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page" ref={rootRef}>
      {/* Background */}
      <div className="login-bg">
        <img src="/calbayog-satilite.png" alt="" className="login-bg-img" />
      </div>
      <div className="login-grad" />

      <div className="login-wrap">
        {/* Brand chip */}
        <Link to="/" className="login-brand">
          <img src="/logo-police.png" alt="PNP Logo" className="login-brand-img" />
          <div className="login-brand-text">
            <span className="login-brand-name">Ligtas Calbayog</span>
            <span className="login-brand-sub">PNP Command Center</span>
          </div>
        </Link>

        <div className="login-card">
          <div className="login-logo">
            <img src="/logo-police.png" alt="PNP Logo" className="login-logo-img" />
          </div>
          <h1 className="login-title">Admin Sign In</h1>
          <p className="login-subtitle">
            Access the PNP Calbayog administrative portal
          </p>

          {error && (
            <div className="login-error">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="login-field">
              <label>Email</label>
              <div className="login-input-wrap">
                <Mail size={16} className="login-input-icon" />
                <input
                  type="email"
                  className="form-input login-input"
                  placeholder="admin@calbayog.gov.ph"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div className="login-field">
              <label>Password</label>
              <div className="login-input-wrap">
                <Lock size={16} className="login-input-icon" />
                <input
                  type={showPassword ? "text" : "password"}
                  className="form-input login-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="login-toggle"
                  onClick={() => setShowPassword((s) => !s)}
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? (
                <>
                  <span className="login-spinner" />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn size={18} />
                  Sign In
                </>
              )}
            </button>
          </form>

          <div className="login-footer">
            <Link to="/" className="login-back">
              <ArrowLeft size={14} />
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
