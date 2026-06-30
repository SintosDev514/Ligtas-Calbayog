import { supabase } from "../supabase/supabaseClient";

/**
 * Create a new announcement (admin only)
 */
export const createAnnouncement = async ({
  title,
  content,
  category,
  imageUrl,
  videoUrl,
  latitude,
  longitude,
  locationName,
  adminId,
}) => {
  const payload = {
    title,
    content,
    category: category || "news",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...(imageUrl ? { image_url: imageUrl } : {}),
    ...(videoUrl ? { video_url: videoUrl } : {}),
    ...(latitude != null ? { latitude } : {}),
    ...(longitude != null ? { longitude } : {}),
    ...(locationName ? { location_name: locationName } : {}),
    ...(adminId ? { admin_id: adminId } : {}),
  };

  const { data, error } = await supabase
    .from("announcements")
    .insert(payload)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

/**
 * Update an existing announcement
 */
export const updateAnnouncement = async (id, updates) => {
  const payload = {
    ...updates,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("announcements")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

/**
 * Delete an announcement
 */
export const deleteAnnouncement = async (id) => {
  const { error } = await supabase
    .from("announcements")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
};

/**
 * Fetch all reports with resident info (admin view)
 */
export const fetchAllReports = async (filters = {}) => {
  let query = supabase
    .from("crime_reports")
    .select("*, resident:resident_profiles(full_name, phone_number, address)")
    .order("created_at", { ascending: false });

  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.crimeType) {
    query = query.eq("crime_type", filters.crimeType);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
};

/**
 * Update report status (accept, request backup, resolve, etc.)
 */
export const updateReportStatus = async (reportId, status, metadata = {}) => {
  const { data, error } = await supabase
    .from("crime_reports")
    .update({
      status,
      updated_at: new Date().toISOString(),
      ...metadata,
    })
    .eq("id", reportId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

/**
 * Add feedback to a report
 */
export const addReportFeedback = async ({
  reportId,
  officerName,
  responseMessage,
  estimatedArrival,
}) => {
  const { data, error } = await supabase
    .from("report_feedback")
    .insert({
      report_id: reportId,
      officer_name: officerName,
      response_message: responseMessage,
      estimated_arrival: estimatedArrival || null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

/**
 * Add action update to a report
 */
export const addActionUpdate = async ({
  reportId,
  actionType,
  description,
}) => {
  const { data, error } = await supabase
    .from("action_updates")
    .insert({
      report_id: reportId,
      action_type: actionType,
      description: description || "",
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

/**
 * Fetch all police officers with their current locations
 */
export const fetchPoliceWithLocations = async () => {
  const { data: officers, error: officersError } = await supabase
    .from("police_profiles")
    .select("*");

  if (officersError) throw new Error(officersError.message);

  const { data: locations, error: locationsError } = await supabase
    .from("police_locations")
    .select("*, report:crime_reports(crime_type, status)");

  if (locationsError) throw new Error(locationsError.message);

  const officerMap = {};
  for (const o of officers) {
    officerMap[o.id] = o;
  }

  const latestPerOfficer = {};
  for (const loc of locations ?? []) {
    const oid = loc.officer_id;
    if (
      !latestPerOfficer[oid] ||
      new Date(loc.updated_at) > new Date(latestPerOfficer[oid].updated_at)
    ) {
      latestPerOfficer[oid] = loc;
    }
  }

  return Object.entries(latestPerOfficer).map(([officerId, loc]) => ({
    ...loc,
    officer: officerMap[officerId] || null,
  }));
};

/**
 * Get admin dashboard stats
 */
export const getDashboardStats = async () => {
  const [
    { count: totalReports },
    { count: pendingReports },
    { count: resolvedReports },
    { count: totalOfficers },
    { count: totalAnnouncements },
    { count: totalResidents },
  ] = await Promise.all([
    supabase.from("crime_reports").select("*", { count: "exact", head: true }),
    supabase
      .from("crime_reports")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("crime_reports")
      .select("*", { count: "exact", head: true })
      .eq("status", "resolved"),
    supabase.from("police_profiles").select("*", { count: "exact", head: true }),
    supabase.from("announcements").select("*", { count: "exact", head: true }),
    supabase.from("resident_profiles").select("*", { count: "exact", head: true }),
  ]);

  return {
    totalReports: totalReports ?? 0,
    pendingReports: pendingReports ?? 0,
    resolvedReports: resolvedReports ?? 0,
    totalOfficers: totalOfficers ?? 0,
    totalAnnouncements: totalAnnouncements ?? 0,
    totalResidents: totalResidents ?? 0,
  };
};

/**
 * Upload an image to Supabase storage
 */
export const uploadAnnouncementImage = async (file, adminId) => {
  const ext = file.name.split(".").pop() || "jpg";
  const filename = `announcement-${adminId}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from("report-photos")
    .upload(filename, file, { contentType: file.type });

  if (error) throw new Error(error.message);

  const { data: urlData } = supabase.storage
    .from("report-photos")
    .getPublicUrl(filename);

  return urlData.publicUrl;
};

/**
 * Check if a user is an admin
 */
export const checkAdminStatus = async (userId) => {
  const { data, error } = await supabase
    .from("users")
    .select("role, status")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.role === "admin" && data?.status === "approved";
};
