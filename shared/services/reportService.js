import { supabase } from "../supabase/supabaseClient";

/**
 * Submit a crime report with optional coordinates
 */
export const submitCrimeReport = async ({
  userId,
  crimeType,
  description,
  latitude,
  longitude,
  locationAddress,
  shareLiveLocation = false,
  photoUrl = null,
}) => {
  const payload = {
    resident_id: userId,
    crime_type: crimeType,
    description: description || "",
    latitude: latitude ?? null,
    longitude: longitude ?? null,
    location_address: locationAddress ?? null,
    share_live_location: shareLiveLocation,
    status: "pending",
    created_at: new Date().toISOString(),
    ...(photoUrl ? { photo_url: photoUrl } : {}),
  };

  const { data, error } = await supabase
    .from("crime_reports")
    .insert(payload)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

/**
 * Fetch all reports submitted by a specific resident
 */
export const fetchResidentReports = async (userId) => {
  const { data, error } = await supabase
    .from("crime_reports")
    .select("*")
    .eq("resident_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
};

/**
 * Fetch PNP announcements (public)
 */
export const fetchAnnouncements = async () => {
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
};

/**
 * Fetch the resident profile by user ID
 */
export const fetchResidentProfile = async (userId) => {
  const { data, error } = await supabase
    .from("resident_profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) throw new Error(error.message);
  return data;
};

/**
 * Fetch police feedback/response for a specific report
 */
export const fetchReportFeedback = async (reportId) => {
  const { data, error } = await supabase
    .from("report_feedback")
    .select("*")
    .eq("report_id", reportId)
    .order("created_at", { ascending: false })
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 = no rows found (not an error)
    throw new Error(error.message);
  }
  return data ?? null;
};

/**
 * Fetch ongoing action updates for a specific report
 */
export const fetchActionUpdates = async (reportId) => {
  const { data, error } = await supabase
    .from("action_updates")
    .select("*")
    .eq("report_id", reportId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
};

/**
 * Subscribe to real-time updates for a specific report
 */
export const subscribeToReportUpdates = (reportId, callback) => {
  const subscription = supabase
    .channel(`report:${reportId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "crime_reports",
        filter: `id=eq.${reportId}`,
      },
      (payload) => callback(payload.new),
    )
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "report_feedback",
        filter: `report_id=eq.${reportId}`,
      },
      (payload) => callback({ type: "feedback", data: payload.new }),
    )
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "action_updates",
        filter: `report_id=eq.${reportId}`,
      },
      (payload) => callback({ type: "action_update", data: payload.new }),
    )
    .subscribe();

  return subscription;
};
