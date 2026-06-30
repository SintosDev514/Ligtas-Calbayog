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
    .maybeSingle();

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
  const channelName = `report:${reportId}:${Date.now()}`;
  const subscription = supabase.channel(channelName);

  subscription.on(
    "postgres_changes",
    {
      event: "UPDATE",
      schema: "public",
      table: "crime_reports",
      filter: `id=eq.${reportId}`,
    },
    (payload) => callback(payload.new),
  );

  subscription.subscribe((status, err) => {
    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      console.warn(`Realtime subscription for ${reportId} failed:`, err?.message);
    }
  });

  return subscription;
};

/**
 * Fetch emergency contact by label (e.g., 'police')
 */
export const fetchEmergencyContact = async (label = "police") => {
  const { data, error } = await supabase
    .from("emergency_contacts")
    .select("*")
    .eq("label", label)
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new Error(error.message);
  }

  return data ?? null;
};

/**
 * Cancel a report and apply progressive penalty
 * Returns { penalty: 'warning' | 'restriction' | 'ban' | null, cancel_count: number }
 */
export const cancelReport = async (reportId, userId) => {
  // Update report status to cancelled
  const { error: reportError } = await supabase
    .from("crime_reports")
    .update({ status: "cancelled" })
    .eq("id", reportId)
    .eq("resident_id", userId);

  if (reportError) throw new Error(reportError.message);

  // Get current cancel count
  const { data: profile, error: profileError } = await supabase
    .from("resident_profiles")
    .select("cancel_count")
    .eq("id", userId)
    .single();

  if (profileError) throw new Error(profileError.message);

  const currentCount = (profile?.cancel_count || 0) + 1;

  // Increment cancel count
  const { error: updateError } = await supabase
    .from("resident_profiles")
    .update({ cancel_count: currentCount })
    .eq("id", userId);

  if (updateError) throw new Error(updateError.message);

  let penaltyType = null;

  if (currentCount === 1) {
    penaltyType = "warning";
  } else if (currentCount === 2) {
    penaltyType = "restriction";
  } else if (currentCount >= 3) {
    penaltyType = "ban";
  }

  // Record penalty
  if (penaltyType) {
    const { error: penaltyError } = await supabase
      .from("penalties")
      .insert({
        user_id: userId,
        type: penaltyType,
        reason: `Cancelled report #${reportId} (cancel #${currentCount})`,
      });

    if (penaltyError) console.warn("Failed to record penalty:", penaltyError.message);
  }

  return { penalty: penaltyType, cancel_count: currentCount };
};

/**
 * Get active penalty for a user (restriction or ban)
 */
export const getActivePenalty = async (userId) => {
  const { data, error } = await supabase
    .from("penalties")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .in("type", ["restriction", "ban"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw new Error(error.message);
  }

  return data ?? null;
};

/**
 * Get the user's cancel count
 */
export const getCancelCount = async (userId) => {
  const { data, error } = await supabase
    .from("resident_profiles")
    .select("cancel_count")
    .eq("id", userId)
    .single();

  if (error) throw new Error(error.message);
  return data?.cancel_count || 0;
};

/**
 * Submit an appeal for a penalty
 */
export const appealPenalty = async (penaltyId, userId, message) => {
  const { data, error } = await supabase
    .from("penalties")
    .update({
      appeal_message: message,
      appeal_status: "pending",
      appealed_at: new Date().toISOString(),
    })
    .eq("id", penaltyId)
    .eq("user_id", userId)
    .eq("appeal_status", "none")
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

/**
 * Upsert police officer's location for a specific report
 */
export const upsertPoliceLocation = async (officerId, reportId, latitude, longitude) => {
  const { data: existing } = await supabase
    .from("police_locations")
    .select("id")
    .eq("officer_id", officerId)
    .eq("report_id", reportId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("police_locations")
      .update({ latitude, longitude, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("police_locations")
      .insert({ officer_id: officerId, report_id: reportId, latitude, longitude });
    if (error) throw new Error(error.message);
  }
};

/**
 * Subscribe to police location updates for a specific report
 */
export const subscribeToPoliceLocation = (reportId, callback) => {
  const channelName = `police-location:${reportId}:${Date.now()}`;
  const subscription = supabase.channel(channelName);

  subscription.on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "police_locations",
      filter: `report_id=eq.${reportId}`,
    },
    (payload) => callback(payload.new),
  );

  subscription.subscribe((status, err) => {
    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      console.warn(`Police location subscription for ${reportId} failed:`, err?.message);
    }
  });

  return subscription;
};

/**
 * Get the latest police location for a report
 */
/**
 * Toggle like on an announcement
 */
export const toggleAnnouncementLike = async (announcementId, userId) => {
  const { data: existing } = await supabase
    .from("announcement_likes")
    .select("id")
    .eq("user_id", userId)
    .eq("announcement_id", announcementId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("announcement_likes")
      .delete()
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return { liked: false };
  } else {
    const { error } = await supabase
      .from("announcement_likes")
      .insert({ user_id: userId, announcement_id: announcementId });
    if (error) throw new Error(error.message);
    return { liked: true };
  }
};

/**
 * Fetch like count and whether the current user liked
 */
export const fetchAnnouncementLikes = async (announcementId, userId) => {
  const { count, error: countError } = await supabase
    .from("announcement_likes")
    .select("id", { count: "exact", head: true })
    .eq("announcement_id", announcementId);
  if (countError) throw new Error(countError.message);

  let liked = false;
  if (userId) {
    const { data: userLike } = await supabase
      .from("announcement_likes")
      .select("id")
      .eq("user_id", userId)
      .eq("announcement_id", announcementId)
      .maybeSingle();
    liked = !!userLike;
  }

  return { count: count ?? 0, liked };
};

/**
 * Fetch like status and count for multiple announcements
 */
export const fetchBatchAnnouncementLikes = async (announcementIds, userId) => {
  if (!announcementIds || announcementIds.length === 0) return {};

  let likedSet = new Set();
  if (userId) {
    const { data: userLikes } = await supabase
      .from("announcement_likes")
      .select("announcement_id")
      .in("announcement_id", announcementIds)
      .eq("user_id", userId);
    likedSet = new Set((userLikes ?? []).map((l) => l.announcement_id));
  }

  const countMap = {};
  for (const id of announcementIds) {
    countMap[id] = 0;
  }
  const { data: allLikes } = await supabase
    .from("announcement_likes")
    .select("announcement_id")
    .in("announcement_id", announcementIds);
  for (const l of allLikes ?? []) {
    countMap[l.announcement_id] = (countMap[l.announcement_id] ?? 0) + 1;
  }

  const result = {};
  for (const id of announcementIds) {
    result[id] = { liked: likedSet.has(id), count: countMap[id] ?? 0 };
  }
  return result;
};

/**
 * Add a comment to an announcement
 */
export const addAnnouncementComment = async (announcementId, userId, content) => {
  const { data, error } = await supabase
    .from("announcement_comments")
    .insert({ user_id: userId, announcement_id: announcementId, content })
    .select()
    .single();

  if (error) throw new Error(error.message);

  const { data: profile } = await supabase
    .from("resident_profiles")
    .select("full_name, avatar_url")
    .eq("id", userId)
    .maybeSingle();

  return { ...data, resident: profile ?? { full_name: "Unknown", avatar_url: null } };
};

/**
 * Fetch comments for an announcement
 */
export const fetchAnnouncementComments = async (announcementId) => {
  const { data, error } = await supabase
    .from("announcement_comments")
    .select("*")
    .eq("announcement_id", announcementId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  const items = data ?? [];

  const userIds = [...new Set(items.map((c) => c.user_id))];
  if (userIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from("resident_profiles")
    .select("id, full_name, avatar_url")
    .in("id", userIds);

  const profileMap = {};
  for (const p of profiles ?? []) {
    profileMap[p.id] = p;
  }

  return items.map((c) => ({
    ...c,
    resident: profileMap[c.user_id] ?? { full_name: "Unknown", avatar_url: null },
  }));
};

/**
 * Fetch comment count for an announcement
 */
export const fetchAnnouncementCommentCount = async (announcementId) => {
  const { count, error } = await supabase
    .from("announcement_comments")
    .select("id", { count: "exact", head: true })
    .eq("announcement_id", announcementId);

  if (error) throw new Error(error.message);
  return count ?? 0;
};

export const fetchPoliceLocation = async (reportId) => {
  const { data, error } = await supabase
    .from("police_locations")
    .select("*, police_profiles(full_name, badge_id, rank)")
    .eq("report_id", reportId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && error.code !== "PGRST116") throw new Error(error.message);
  return data ?? null;
};
