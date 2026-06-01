import { supabase } from "../supabase/supabaseClient";

export const fetchContacts = async (userId) => {
  const { data, error } = await supabase
    .from("family_contacts")
    .select("*")
    .eq("user_id", userId)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
};

export const addContact = async (userId, { name, phoneNumber, relationship, contactUserId }) => {
  const { data, error } = await supabase
    .from("family_contacts")
    .insert({
      user_id: userId,
      name,
      phone_number: phoneNumber,
      relationship: relationship || "Friend",
      contact_user_id: contactUserId || null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

export const deleteContact = async (contactId) => {
  const { error } = await supabase
    .from("family_contacts")
    .delete()
    .eq("id", contactId);

  if (error) throw new Error(error.message);
};

export const fetchMessages = async (contactId) => {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
};

export const fetchConversation = async (userId1, userId2) => {
  const conversationId = [userId1, userId2].sort().join("_");
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
};

export const sendMessage = async (userId, contactId, { content, type = "text", latitude, longitude, receiverId }) => {
  const conversationId = receiverId
    ? [userId, receiverId].sort().join("_")
    : userId;

  const { data, error } = await supabase
    .from("messages")
    .insert({
      user_id: userId,
      contact_id: contactId,
      content: content || "",
      message_type: type,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      sender_id: userId,
      receiver_id: receiverId || null,
      conversation_id: conversationId,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

export const fetchLatestMessagePerContact = async (userId) => {
  const [contacts, sentMsgs] = await Promise.all([
    supabase
      .from("family_contacts")
      .select("id, user_id, name, phone_number, relationship, contact_user_id")
      .eq("user_id", userId),
    supabase
      .from("messages")
      .select("*, contact:contact_id(id, name, phone_number, relationship)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  const latest = {};
  for (const msg of sentMsgs.data ?? []) {
    const cid = msg.contact_id;
    if (cid && !latest[cid]) {
      latest[cid] = msg;
    }
  }

  const { data: receivedMsgs } = await supabase
    .from("messages")
    .select("*")
    .eq("receiver_id", userId)
    .order("created_at", { ascending: false });

  const contactMap = {};
  for (const c of contacts.data ?? []) {
    contactMap[c.contact_user_id] = c;
    contactMap[c.id] = c;
  }

  for (const msg of receivedMsgs ?? []) {
    const matchedContact = msg.sender_id ? contactMap[msg.sender_id] : null;
    if (matchedContact) {
      const cid = matchedContact.id;
      if (!latest[cid]) {
        latest[cid] = { ...msg, contact_id: cid, contact: matchedContact };
      }
    }
  }

  return Object.values(latest);
};

export const searchUsers = async (query) => {
  if (!query || query.trim().length < 2) return [];
  try {
    const { data, error } = await supabase.rpc("search_residents", {
      search_term: query.trim(),
    });
    if (error) throw error;
    return data ?? [];
  } catch {
    const { data, error } = await supabase
      .from("resident_profiles")
      .select("full_name, phone_number")
      .ilike("full_name", `%${query.trim()}%`)
      .limit(10);
    if (error) return [];
    return data ?? [];
  }
};

export const sendContactRequest = async (fromUserId, { phoneNumber, relationship }) => {
  const { data: target, error: lookupError } = await supabase
    .rpc("get_user_by_phone", { phone: phoneNumber })
    .maybeSingle();

  if (lookupError || !target) {
    throw new Error("User not found with that phone number");
  }

  const { data: requester } = await supabase
    .from("resident_profiles")
    .select("full_name")
    .eq("id", fromUserId)
    .single();

  const fromName = requester?.full_name || "Unknown";

  const { data: request, error: reqError } = await supabase
    .from("contact_requests")
    .insert({
      from_user_id: fromUserId,
      to_user_id: target.id,
      from_name: fromName,
      from_phone: phoneNumber,
      relationship: relationship || "Friend",
      status: "pending",
    })
    .select()
    .single();

  if (reqError) throw new Error(reqError.message);

  await supabase.from("notifications").insert({
    user_id: target.id,
    type: "contact_request",
    title: "Contact Request",
    body: `${fromName} wants to add you as a contact`,
    data: { request_id: request.id, from_user_id: fromUserId },
  });

  return request;
};

export const respondToRequest = async (requestId, action) => {
  const { data: request, error: fetchError } = await supabase
    .from("contact_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (fetchError || !request) throw new Error("Request not found");

  if (action === "accepted") {
    const { data: requesterProfile } = await supabase
      .rpc("get_profile_by_id", { uid: request.from_user_id })
      .maybeSingle();

    const { data: acceptorProfile } = await supabase
      .rpc("get_profile_by_id", { uid: request.to_user_id })
      .maybeSingle();

    const fromName = requesterProfile?.full_name || request.from_name;
    const fromPhone = requesterProfile?.phone_number || "";
    const toName = acceptorProfile?.full_name || "Unknown";
    const toPhone = acceptorProfile?.phone_number || "";

    await supabase.from("family_contacts").insert([
      {
        user_id: request.to_user_id,
        name: fromName,
        phone_number: fromPhone,
        relationship: request.relationship,
        contact_user_id: request.from_user_id,
      },
      {
        user_id: request.from_user_id,
        name: toName,
        phone_number: toPhone,
        relationship: request.relationship,
        contact_user_id: request.to_user_id,
      },
    ]);

    await supabase.from("notifications").insert({
      user_id: request.from_user_id,
      type: "contact_request_accepted",
      title: "Request Accepted",
      body: `${toName} accepted your contact request`,
      data: { other_user_id: request.to_user_id },
    });
  }

  const { error: updateError } = await supabase
    .from("contact_requests")
    .update({ status: action, updated_at: new Date().toISOString() })
    .eq("id", requestId);

  if (updateError) throw new Error(updateError.message);
};

export const fetchPendingRequests = async (userId) => {
  const { data, error } = await supabase
    .from("contact_requests")
    .select("*")
    .eq("to_user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
};

export const fetchNotifications = async (userId) => {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw new Error(error.message);
  return data ?? [];
};

export const getUnreadCount = async (userId) => {
  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false);

  if (error) return 0;
  return count ?? 0;
};

export const markNotificationRead = async (notificationId) => {
  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", notificationId);
};

export const markAllNotificationsRead = async (userId) => {
  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false);
};
