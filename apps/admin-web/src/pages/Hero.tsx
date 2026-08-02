import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import {
  Shield,
  Radio,
  LogIn,
  ArrowRight,
  Eye,
  MapPin,
  Users,
  BarChart3,
  AlertTriangle,
  Clock,
  Info,
  Mail,
  Phone,
  Smartphone,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../supabase";

gsap.registerPlugin(ScrollTrigger, useGSAP);

function GithubIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

export default function Hero() {
  const { isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);

  const [contactInfo, setContactInfo] = useState({
    email: "",
    phone: "911",
  });

  useEffect(() => {
    if (!isLoading && isAdmin) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAdmin, isLoading, navigate]);

  useEffect(() => {
    supabase
      .from("station_settings")
      .select("*")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setContactInfo({
            email: data.contact_email || contactInfo.email,
            phone: data.police_phone || contactInfo.phone,
          });
        }
      })
      .catch(() => {});
  }, []);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // Hero entrance timeline
        const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
        tl.fromTo(
          ".hp-topbar",
          { y: -24, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.7 }
        )
          .fromTo(
            ".hp-glass",
            { y: 46, opacity: 0, scale: 0.96 },
            { y: 0, opacity: 1, scale: 1, duration: 0.85 },
            "-=0.35"
          )
          .fromTo(
            ".hp-headline",
            { y: 22, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.65 },
            "-=0.3"
          )
          .fromTo(
            ".hp-desc",
            { y: 18, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.6 },
            "-=0.35"
          )
          .fromTo(
            ".hp-cta-row",
            { y: 14, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.5 },
            "-=0.3"
          )
          .fromTo(
            ".hp-mini-stats > .hp-mini-stat",
            { y: 16, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.5, stagger: 0.09 },
            "-=0.3"
          )
          .fromTo(
            ".hp-features .hp-feat",
            { x: 28, opacity: 0 },
            { x: 0, opacity: 1, duration: 0.42, stagger: 0.07 },
            "-=0.55"
          )
          .fromTo(
            ".hp-footer",
            { opacity: 0 },
            { opacity: 1, duration: 0.5 },
            "-=0.25"
          );

        // Background slow zoom
        gsap.fromTo(
          ".hp-bg-img",
          { scale: 1.18 },
          {
            scale: 1,
            ease: "none",
            scrollTrigger: {
              trigger: ".hp-hero",
              start: "top top",
              end: "bottom top",
              scrub: true,
            },
          }
        );

        // Hero content parallax on scroll out
        gsap.to(".hp-main", {
          yPercent: -12,
          opacity: 0.2,
          ease: "none",
          scrollTrigger: {
            trigger: ".hp-hero",
            start: "top top",
            end: "bottom 25%",
            scrub: true,
          },
        });

        // Mobile about intro reveal (below hero card)
        gsap.fromTo(
          ".hp-hero-about-head",
          { opacity: 0, y: 30 },
          {
            opacity: 1,
            y: 0,
            duration: 0.7,
            ease: "power3.out",
            scrollTrigger: {
              trigger: ".hp-hero-about-head",
              start: "top 90%",
            },
          }
        );

        // About section reveals
        gsap.fromTo(
          ".hp-about .hp-chip",
          { opacity: 0, y: 26 },
          {
            opacity: 1,
            y: 0,
            duration: 0.7,
            ease: "power3.out",
            scrollTrigger: { trigger: ".hp-about", start: "top 78%" },
          }
        );
        gsap.fromTo(
          ".hp-about .hp-section-title",
          { opacity: 0, y: 26 },
          {
            opacity: 1,
            y: 0,
            duration: 0.7,
            ease: "power3.out",
            scrollTrigger: { trigger: ".hp-about", start: "top 74%" },
          }
        );
        gsap.fromTo(
          ".hp-about .hp-section-desc",
          { opacity: 0, y: 26 },
          {
            opacity: 1,
            y: 0,
            duration: 0.7,
            ease: "power3.out",
            scrollTrigger: { trigger: ".hp-about", start: "top 70%" },
          }
        );
        // About cards — interactive scroll scrub (staggered lift + slight parallax drift)
        gsap.fromTo(
          ".hp-about-card",
          { opacity: 0, y: 80, rotationX: -10, scale: 0.94 },
          {
            opacity: 1,
            y: 0,
            rotationX: 0,
            scale: 1,
            stagger: 0.16,
            ease: "none",
            scrollTrigger: {
              trigger: ".hp-about-grid",
              start: "top 85%",
              end: "top 30%",
              scrub: true,
            },
          }
        );
        gsap.to(".hp-about-grid", {
          y: -40,
          ease: "none",
          scrollTrigger: {
            trigger: ".hp-about-grid",
            start: "top 80%",
            end: "bottom top",
            scrub: true,
          },
        });

        // Contact section reveals
        gsap.fromTo(
          ".hp-contact .hp-chip",
          { opacity: 0, y: 26 },
          {
            opacity: 1,
            y: 0,
            duration: 0.7,
            ease: "power3.out",
            scrollTrigger: { trigger: ".hp-contact", start: "top 78%" },
          }
        );
        gsap.fromTo(
          ".hp-contact .hp-section-title",
          { opacity: 0, y: 26 },
          {
            opacity: 1,
            y: 0,
            duration: 0.7,
            ease: "power3.out",
            scrollTrigger: { trigger: ".hp-contact", start: "top 74%" },
          }
        );
        gsap.fromTo(
          ".hp-contact .hp-section-desc",
          { opacity: 0, y: 26 },
          {
            opacity: 1,
            y: 0,
            duration: 0.7,
            ease: "power3.out",
            scrollTrigger: { trigger: ".hp-contact", start: "top 70%" },
          }
        );
        gsap.fromTo(
          ".hp-contact-card",
          { opacity: 0, y: 46 },
          {
            opacity: 1,
            y: 0,
            duration: 0.65,
            stagger: 0.12,
            ease: "power3.out",
            scrollTrigger: { trigger: ".hp-contact-grid", start: "top 82%" },
          }
        );
      });

      // Smooth scrolling for anchor nav links (works regardless of reduced motion)
      document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((link) => {
        link.addEventListener("click", (e) => {
          const id = link.getAttribute("href");
          if (!id || id === "#") return;
          const el = document.querySelector(id);
          if (el) {
            e.preventDefault();
            el.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        });
      });

      return () => {
        mm.revert();
      };
    },
    { scope: rootRef }
  );

  if (isLoading) return null;
  if (isAdmin) return null;

  return (
    <div className="hp" ref={rootRef}>
      {/* Hero — full screen */}
      <section className="hp-hero">
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
          <div className="hp-topbar-left">
            <div className="hp-topbar-brand">
              <img src="/logo-police.png" alt="PNP Logo" className="hp-topbar-logo" />
              <div className="hp-topbar-brand-text">
                <span className="hp-topbar-name">Ligtas Calbayog</span>
                <span className="hp-topbar-sub">PNP Command Center</span>
              </div>
            </div>
            <nav className="hp-topbar-nav">
              <a href="#about">About</a>
              <a href="#contact">Contact</a>
            </nav>
          </div>
          <button className="hp-topbar-login" onClick={() => navigate("/login")}>
            <LogIn size={15} />
            Admin Login
          </button>
        </header>

        {/* Main content — bottom-left anchored */}
        <div className="hp-main">
          <div className="hp-glass">
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
              <a
                className="hp-cta"
                href="https://github.com/SintosDev514/Ligtas-Calbayog/releases/latest/download/resident-app-litascalbayog.apk"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>Download Resident App — Ligtas Calbayog</span>
                <ArrowRight size={16} />
              </a>
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
            </div>
          </div>

          {/* Feature strip on the right edge of glass */}
          <div className="hp-features">
            {[
              { icon: Radio, label: "Real-Time Dispatch", color: "#3b82f6" },
              { icon: Eye, label: "Crime Heatmaps", color: "#60a5fa" },
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

        {/* About intro — shown below hero card on mobile to fill black space */}
        <div className="hp-hero-about-head">
          <div className="hp-chip">
            <Info size={12} />
            About
          </div>
          <h2 className="hp-section-title">
            Built to Keep <span className="hp-section-title-accent">Calbayog Safe</span>
          </h2>
          <p className="hp-section-desc">
            Ligtas Calbayog unifies residents, police patrols, and administrators
            into one coordinated emergency response platform. Every report is
            logged, every response is tracked, and every barangay stays connected.
          </p>
        </div>
      </section>

      {/* About */}
      <section id="about" className="hp-section hp-about">
        <div className="hp-section-inner">
          <div className="hp-about-head">
            <div className="hp-chip">
              <Info size={12} />
              About
            </div>
            <h2 className="hp-section-title">
              Built to Keep <span className="hp-section-title-accent">Calbayog Safe</span>
            </h2>
            <p className="hp-section-desc">
              Ligtas Calbayog unifies residents, police patrols, and administrators
              into one coordinated emergency response platform. Every report is
              logged, every response is tracked, and every barangay stays connected.
            </p>
          </div>
          <div className="hp-about-grid">
            <div className="hp-about-card">
              <div className="hp-about-icon hp-about-icon--green">
                <Smartphone size={18} />
              </div>
              <h3>For Residents</h3>
              <p>
                Report incidents, send SOS alerts, and receive real-time updates
                from your barangay using the resident app.
              </p>
            </div>
            <div className="hp-about-card">
              <div className="hp-about-icon hp-about-icon--blue">
                <Radio size={18} />
              </div>
              <h3>For Police Patrols</h3>
              <p>
                Receive dispatch alerts, track GPS locations, and resolve cases
                in real time from the field.
              </p>
            </div>
            <div className="hp-about-card">
              <div className="hp-about-icon hp-about-icon--blue">
                <BarChart3 size={18} />
              </div>
              <h3>For Administrators</h3>
              <p>
                Manage officers, monitor performance, and view crime analytics
                from a single command center.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="hp-section hp-contact">
        <div className="hp-section-inner">
          <div className="hp-chip">
            <Mail size={12} />
            Contact
          </div>
          <h2 className="hp-section-title">
            Reach the <span className="hp-section-title-accent">Command Center</span>
          </h2>
          <p className="hp-section-desc">
            For emergencies, always contact the nearest police station or use the
            resident app SOS alert. For support and inquiries, reach out below.
          </p>
          <div className="hp-contact-grid">
            <div className="hp-contact-card">
              <div className="hp-contact-icon">
                <Mail size={18} />
              </div>
              <span className="hp-contact-label">Email</span>
              {contactInfo.email ? (
                <a className="hp-contact-value" href={`mailto:${contactInfo.email}`}>
                  {contactInfo.email}
                </a>
              ) : (
                <span className="hp-contact-value">Set contact email in Admin Settings</span>
              )}
            </div>
            <div className="hp-contact-card">
              <div className="hp-contact-icon">
                <Phone size={18} />
              </div>
              <span className="hp-contact-label">Hotline</span>
              <a className="hp-contact-value" href={`tel:${contactInfo.phone}`}>
                {contactInfo.phone} — Calbayog Police
              </a>
            </div>
            <div className="hp-contact-card">
              <div className="hp-contact-icon">
                <MapPin size={18} />
              </div>
              <span className="hp-contact-label">Address</span>
              <span className="hp-contact-value">
                Calbayog City Police Station, Calbayog City
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="hp-footer">
        <div className="hp-footer-right">
          <a
            href="https://github.com/SintosDev514"
            target="_blank"
            rel="noreferrer"
            className="hp-footer-github"
          >
            <GithubIcon size={14} />
            SintosDev514
          </a>
        </div>
      </footer>
    </div>
  );
}
