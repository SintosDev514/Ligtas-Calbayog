import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Reports from "./pages/Reports";
import ReportDetail from "./pages/ReportDetail";
import Announcements from "./pages/Announcements";
import CreateAnnouncement from "./pages/CreateAnnouncement";
import PoliceTracking from "./pages/PoliceTracking";
import ActiveIncidents from "./pages/ActiveIncidents";
import ResolvedCases from "./pages/ResolvedCases";
import PatrolUnits from "./pages/PatrolUnits";
import PatrolHistory from "./pages/PatrolHistory";
import ShiftSchedule from "./pages/ShiftSchedule";
import PoliceOfficers from "./pages/PoliceOfficers";
import DutyAssignment from "./pages/DutyAssignment";
import Performance from "./pages/Performance";
import CrimeStatistics from "./pages/CrimeStatistics";
import CrimeHeatmap from "./pages/CrimeHeatmap";
import ResponseTime from "./pages/ResponseTime";
import ResidentFeedback from "./pages/ResidentFeedback";
import Evidence from "./pages/Evidence";
import Barangays from "./pages/Barangays";
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
        <div className="spinner" />
        <p>Loading...</p>
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
        <div className="spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={isAdmin ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="reports" element={<Reports />} />
        <Route path="reports/:id" element={<ReportDetail />} />
        <Route path="announcements" element={<Announcements />} />
        <Route path="announcements/create" element={<CreateAnnouncement />} />
        <Route path="announcements/edit/:id" element={<CreateAnnouncement />} />
        <Route path="police-tracking" element={<PoliceTracking />} />
        <Route path="active-incidents" element={<ActiveIncidents />} />
        <Route path="resolved-cases" element={<ResolvedCases />} />
        <Route path="patrol-units" element={<PatrolUnits />} />
        <Route path="patrol-history" element={<PatrolHistory />} />
        <Route path="shift-schedule" element={<ShiftSchedule />} />
        <Route path="police-officers" element={<PoliceOfficers />} />
        <Route path="duty-assignment" element={<DutyAssignment />} />
        <Route path="performance" element={<Performance />} />
        <Route path="crime-statistics" element={<CrimeStatistics />} />
        <Route path="crime-heatmap" element={<CrimeHeatmap />} />
        <Route path="response-time" element={<ResponseTime />} />
        <Route path="resident-feedback" element={<ResidentFeedback />} />
        <Route path="evidence" element={<Evidence />} />
        <Route path="barangays" element={<Barangays />} />
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
