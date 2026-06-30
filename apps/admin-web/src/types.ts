export interface AdminProfile {
  id: string;
  email: string;
  full_name?: string;
  role: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  category: string;
  image_url?: string;
  video_url?: string;
  image_urls?: string[];
  video_urls?: string[];
  latitude?: number;
  longitude?: number;
  location_name?: string;
  admin_id?: string;
  created_at: string;
  updated_at: string;
}

export interface CrimeReport {
  id: string;
  resident_id: string;
  crime_type: string;
  description: string;
  latitude?: number;
  longitude?: number;
  location_address?: string;
  status: string;
  photo_url?: string;
  share_live_location: boolean;
  created_at: string;
  updated_at: string;
  resident: {
    full_name: string;
    phone_number: string;
    address: string;
  };
}

export interface PoliceOfficer {
  id: string;
  full_name: string;
  badge_id: string;
  rank: string;
  station: string;
  phone_number?: string;
  police_id_photo_url?: string;
}

export interface PoliceLocation {
  id: string;
  officer_id: string;
  report_id: string;
  latitude: number;
  longitude: number;
  updated_at: string;
  officer: PoliceOfficer;
  report: {
    crime_type: string;
    status: string;
  };
}

export interface DashboardStats {
  totalReports: number;
  pendingReports: number;
  resolvedReports: number;
  totalOfficers: number;
  totalAnnouncements: number;
  totalResidents: number;
}
