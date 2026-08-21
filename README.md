# Ligtas Calbayog

Ligtas Calbayog is a multi-platform community safety and emergency response system built for the citizens of Calbayog City, Samar, Philippines. The platform connects residents, the Philippine National Police (PNP), and local administration through a unified ecosystem of mobile applications and a web-based command dashboard.

"Ligtas" is the Filipino word for "safe" — the project exists to make Calbayog a safer city by giving every resident a direct, transparent, and accountable channel to report incidents, request help, and stay informed.

---

## Table of Contents

- [About](#about)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Repository Structure](#repository-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Documentation](#documentation)
- [Security](#security)
- [Roadmap](#roadmap)

---

## About

Ligtas Calbayog is a monorepo containing three interconnected applications and a shared backend layer:

1. **Resident App** — a mobile application that lets residents report incidents, track police response in real time, receive official PNP announcements, and connect with family and safety contacts.
2. **Police App** — a mobile application for law enforcement to monitor incoming reports, respond to emergencies, share live officer locations, and manage cases from dispatch to resolution.
3. **Admin Web Dashboard** — a web-based command center for administrators to manage reports, officers, announcements, crime analytics, and system users.

All applications share a single Supabase backend (PostgreSQL, authentication, realtime, and storage) with strict row-level security.

---

## Features

### Resident App

- **Secure multi-step registration** — verified email via OTP, barangay selection, GPS address pinning on a map, government ID photo upload, and optional guardian/family information.
- **Incident reporting** — submit reports by crime category with automatic GPS coordinates, reverse-geocoded addresses, and optional photo/video evidence.
- **Report tracking** — follow reports through statuses (pending, under review, in-progress, resolved, dismissed, cancelled) with color-coded badges, police feedback, and a chronological action timeline.
- **Live police tracking** — view the responding officer's location in real time on a map, with driving route, distance, and estimated time of arrival computed via the OSRM routing service.
- **Official announcements** — browse PNP advisories, alerts, news, and events with images, videos, likes, and comments.
- **Safety contacts and messaging** — build a network of family contacts, send and accept contact requests, and exchange text and location messages.
- **False report prevention** — progressive penalties (warning, restriction, ban) for cancelled or false reports, with an appeal mechanism.
- **Notifications** — in-app notifications and local push notifications for report status changes, messages, and announcements.

### Police App

- **Live incident dashboard** — an interactive map showing pending reports, resident locations, police posts, and officer positions with emergency and all-markers filters.
- **Emergency alerting** — real-time alarms with siren audio and vibration when a new emergency report arrives, with auto-dismiss on resolution.
- **Case management** — open report details, review evidence, view the resident's profile, accept reports, send response messages, add action updates, and mark cases resolved.
- **Scene navigation** — turn-by-turn-style routing to the incident location with distance and ETA, plus street view imagery.
- **Officer location sharing** — continuous background location heartbeats so command centers and residents can see responding officers.
- **Pending approval workflow** — police officer accounts are created in a pending state and activated by an administrator.

### Admin Web Dashboard

- **Command overview** — key performance indicators for total, pending, and resolved reports, officers, announcements, and registered residents.
- **Report management** — full report list, detail views, status transitions, evidence gallery, and resident feedback.
- **Crime analytics** — crime statistics, an interactive crime heatmap, and response-time metrics.
- **Announcement publishing** — rich announcement creation with images, videos, and pinned map locations.
- **Police operations** — live officer tracking, patrol history, patrol units, duty assignment, and officer performance.
- **User administration** — user management, role-based access control, notification management, audit logs, and system settings.

### Backend & Infrastructure

- **Supabase backend** — PostgreSQL database, authentication, realtime subscriptions, and object storage.
- **41 SQL migrations** — a complete, versioned schema covering profiles, reports, feedback, action updates, announcements, messaging, penalties, police locations, and role-based access control.
- **Supabase Edge Functions** — an OTP email delivery function and a face detection function for identity verification.
- **Shared service layer** — reusable auth, report, admin, messaging, push notification, and caching modules consumed by all apps.

---

## Technology Stack

| Layer           | Technologies                                                                                   |
| --------------- | ---------------------------------------------------------------------------------------------- |
| Mobile          | React Native, Expo SDK 54, Expo Router, React 19                                                |
| Web dashboard   | React 19, Vite, TypeScript, React Router                                                       |
| Maps            | MapLibre GL, Mapbox GL, react-native-maps, Leaflet (web), OSRM routing, Mapillary street view  |
| Visualization   | GSAP, Three.js                                                                                 |
| Backend         | Supabase (PostgreSQL, Auth, Realtime, Storage, Edge Functions)                                 |
| Push            | Expo Notifications                                                                             |

---

## Repository Structure

```
ligtas-calbayog/
├── apps/
│   ├── resident-app/          # Resident mobile app (Expo / React Native)
│   ├── police-app/            # Police mobile app (Expo / React Native)
│   └── admin-web/             # Admin command dashboard (React / Vite / TypeScript)
├── shared/
│   ├── models/                # Shared data models
│   ├── services/              # Shared service layer (auth, reports, admin, messages, push, cache)
│   ├── supabase/              # Supabase client configuration
│   └── utils/                 # Shared utilities (e.g., street view)
├── supabase/
│   └── functions/             # Supabase Edge Functions (send-otp, detect-face)
├── db/
│   └── migrations/            # Versioned SQL schema migrations (001-041)
├── docs/                      # Documentation and reference material
└── backend/                   # Backend workspace (functions)
```

---

## Getting Started

### Prerequisites

- Node.js 18 or newer
- npm
- A Supabase project (free tier is sufficient)
- Android Studio / Xcode / Expo Go for mobile development

### 1. Install dependencies

```bash
npm install
```

Install dependencies for each application individually:

```bash
cd apps/resident-app && npm install
cd ../police-app && npm install
cd ../admin-web && npm install
```

### 2. Configure Supabase

Create a Supabase project and copy your project URL and anon (publishable) key. Set them in the environment variables described below, or update `shared/supabase/supabaseClient.js` for local development.

### 3. Set up the database

Run the SQL migrations in `db/migrations/` in order against your Supabase project. Each file is self-contained and versioned, covering tables, row-level security policies, realtime publications, and storage buckets. For a quick manual setup, the schema is also summarized in `DATABASE_SCHEMA.md`.

### 4. Deploy Edge Functions (optional)

The OTP and face detection functions live in `supabase/functions/`. Deploy them with the Supabase CLI:

```bash
cd supabase
supabase functions deploy send-otp
supabase functions deploy detect-face
```

Configure the required secrets (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OTP_SALT`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`) in the Supabase dashboard.

### 5. Run the applications

**Resident App:**

```bash
cd apps/resident-app
npm start
```

**Police App:**

```bash
cd apps/police-app
npm start
```

**Admin Dashboard:**

```bash
cd apps/admin-web
npm run dev
```

---

## Environment Variables

Create a `.env` file in each application as needed:

```bash
# shared/supabase/supabaseClient.js or app-level .env
EXPO_PUBLIC_SUPABASE_URL=your-supabase-project-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

The admin dashboard reads its Supabase configuration from `apps/admin-web/.env` (`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`). The `.env` files are gitignored and must never be committed.

---

## Database Setup

The complete database schema is documented in `DATABASE_SCHEMA.md`. Key tables include:

- `users` — accounts with roles (`resident`, `police`, `admin`) and approval status
- `resident_profiles` — resident identity and contact information
- `police_profiles` — officer identity, rank, badge, and station assignment
- `crime_reports` — incident reports with location and evidence
- `report_feedback` — police response messages and estimated arrival
- `action_updates` — chronological officer action timeline
- `announcements` — official PNP communications with media and reactions
- `police_locations` — live officer location tracking
- `messages` / `family_contacts` / `contact_requests` — resident safety network and messaging
- `penalties` — false report penalty records and appeals

Row-level security is enforced on all tables so residents can only access their own data, officers access their assigned scope, and administrators manage the platform.

---

## Documentation

| Document                  | Purpose                                             |
| ------------------------- | --------------------------------------------------- |
| `DATABASE_SCHEMA.md`      | Complete database schema and setup guide            |
| `IMPLEMENTATION_GUIDE.md` | Feature documentation and user flows                |
| `POLICE_BACKEND_SETUP.md` | Police backend and API configuration                |
| `QUICK_START.md`          | Fast local setup and testing walkthrough            |
| `PROJECT_SUMMARY.md`      | Implementation summary and status                   |

---

## Security

- Authentication handled through Supabase Auth with email/password and OTP verification.
- All data access is protected by PostgreSQL row-level security policies.
- Evidence and ID photo uploads are stored in Supabase Storage with restricted access.
- Role-based access control distinguishes residents, police officers, and administrators.
- False-report penalties help deter misuse of the emergency reporting system.

---

## Roadmap

- [x] Resident reporting, tracking, and real-time updates
- [x] PNP announcements with media and reactions
- [x] Resident safety network and messaging
- [x] Police response app with live officer tracking
- [x] Admin command dashboard with analytics and heatmaps
- [x] False-report penalty and appeal system
- [ ] Production push notification backend (Expo Push service integration)
- [ ] Deployment pipelines for app stores and the web dashboard

---

## License

This project is developed for academic and community use as a capstone project. Please contact the project maintainers for licensing inquiries.

---

_Built for the safety, health, and empowerment of Calbayog City._
