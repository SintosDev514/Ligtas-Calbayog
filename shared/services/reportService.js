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
}) => {
  const { data, error } = await supabase.from("crime_reports").insert({
    resident_id: userId,
    crime_type: crimeType,
    description: description || "",
    latitude: latitude ?? null,
    longitude: longitude ?? null,
    location_address: locationAddress ?? null,
    share_live_location: shareLiveLocation,
    status: "pending",
    created_at: new Date().toISOString(),
  }).select().single();

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
