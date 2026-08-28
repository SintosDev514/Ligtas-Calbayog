import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import Hero from "./pages/Hero";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Reports from "./pages/Reports";
import ReportTriage from "./pages/ReportTriage";
import ReportDetail from "./pages/ReportDetail";
import Announcements from "./pages/Announcements";
import CreateAnnouncement from "./pages/CreateAnnouncement";
import PoliceTracking from "./pages/PoliceTracking";
import ActiveIncidents from "./pages/ActiveIncidents";
import ResolvedCases from "./pages/ResolvedCases";
import PatrolHistory from "./pages/PatrolHistory";
import PoliceOfficers from "./pages/PoliceOfficers";
import DutyAssignment from "./pages/DutyAssignment";
import Performance from "./pages/Performance";
import CrimeStatistics from "./pages/CrimeStatistics";
import CrimeHeatmap from "./pages/CrimeHeatmap";
import ResponseTime from "./pages/ResponseTime";
import ResidentFeedback from "./pages/ResidentFeedback";
import Evidence from "./pages/Evidence";

import Notifications from "./pages/Notifications";
import Users from "./pages/Users";
import Roles from "./pages/Roles";
import AuditLogs from "./pages/AuditLogs";
import Settings from "./pages/Settings";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="loading-screen">
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

  if (!isAdmin) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const { isAdmin, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="loading-screen">
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
    <Routes>
      <Route path="/" element={<Hero />} />
      <Route
        path="/login"
        element={isAdmin ? <Navigate to="/dashboard" replace /> : <Login />}
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="reports" element={<Reports />} />
        <Route path="report-triage" element={<ReportTriage />} />
        <Route path="reports/:id" element={<ReportDetail />} />
        <Route path="announcements" element={<Announcements />} />
        <Route path="announcements/create" element={<CreateAnnouncement />} />
        <Route path="announcements/edit/:id" element={<CreateAnnouncement />} />
        <Route path="police-tracking" element={<PoliceTracking />} />
        <Route path="active-incidents" element={<ActiveIncidents />} />
        <Route path="resolved-cases" element={<ResolvedCases />} />
        <Route path="patrol-history" element={<PatrolHistory />} />
        <Route path="police-officers" element={<PoliceOfficers />} />
        <Route path="duty-assignment" element={<DutyAssignment />} />
        <Route path="performance" element={<Performance />} />
        <Route path="crime-statistics" element={<CrimeStatistics />} />
        <Route path="crime-heatmap" element={<CrimeHeatmap />} />
        <Route path="response-time" element={<ResponseTime />} />
        <Route path="resident-feedback" element={<ResidentFeedback />} />
        <Route path="evidence" element={<Evidence />} />

        <Route path="notifications" element={<Notifications />} />
        <Route path="users" element={<Users />} />
        <Route path="roles" element={<Roles />} />
        <Route path="audit-logs" element={<AuditLogs />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
