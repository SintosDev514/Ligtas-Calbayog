import { supabase } from "../supabase/supabaseClient";

// Upload liveness photo to Supabase Storage and return the public URL
const uploadLivenessPhoto = async (uid, uri) => {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();

    const filePath = `residents/${uid}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("liveness-photos")
      .upload(filePath, blob, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      console.warn("Liveness photo upload failed:", uploadError.message);
      return null;
    }

    const { data } = supabase.storage
      .from("liveness-photos")
      .getPublicUrl(filePath);

    return data?.publicUrl ?? null;
  } catch (err) {
    console.warn("Liveness photo upload error:", err);
    return null;
  }
};

export const registerResident = async (data) => {
  const { email, password, selfieUri, ...profile } = data;

  // 1. Create the auth user
  const { data: authData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (signUpError) throw new Error(signUpError.message);

  const uid = authData.user?.id;
  if (!uid) throw new Error("Failed to create user account.");

  // 2. Upload liveness photo if provided
  const livenessPhotoURL = selfieUri
    ? await uploadLivenessPhoto(uid, selfieUri)
    : null;

  // 3. Insert into users table
  const { error: userInsertError } = await supabase.from("users").insert({
    id: uid,
    email,
    role: "resident",
    status: "approved",
    created_at: new Date().toISOString(),
  });

  if (userInsertError) throw new Error(userInsertError.message);

  // 4. Insert into resident_profiles table
  const { error: profileInsertError } = await supabase
    .from("resident_profiles")
    .insert({
      id: uid,
      full_name: profile.fullName,
      address: profile.address,
      phone_number: profile.phoneNumber,
      emergency_contact: profile.emergencyContact,
      father_name: profile.fatherName,
      mother_name: profile.motherName,
      liveness_photo_url: livenessPhotoURL,
      liveness_verified: !!livenessPhotoURL,
    });

  if (profileInsertError) throw new Error(profileInsertError.message);
};

export const registerPolice = async (data) => {
  const { email, password, ...profile } = data;

  // 1. Create the auth user
  const { data: authData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (signUpError) throw new Error(signUpError.message);

  const uid = authData.user?.id;
  if (!uid) throw new Error("Failed to create user account.");

  // 2. Insert into users table
  const { error: userInsertError } = await supabase.from("users").insert({
    id: uid,
    email,
    role: "police",
    status: "pending",
    created_at: new Date().toISOString(),
  });

  if (userInsertError) throw new Error(userInsertError.message);

  // 3. Insert into police_profiles table
  const { error: profileInsertError } = await supabase
    .from("police_profiles")
    .insert({
      id: uid,
      ...profile,
    });

  if (profileInsertError) throw new Error(profileInsertError.message);
};

export const loginUser = async (email, password) => {
  const { data: authData, error: signInError } =
    await supabase.auth.signInWithPassword({ email, password });

  if (signInError) throw new Error(signInError.message);

  const uid = authData.user?.id;
  if (!uid) throw new Error("Login failed. Please try again.");

  // Fetch the user's role and status from the users table
  const { data: userData, error: fetchError } = await supabase
    .from("users")
    .select("*")
    .eq("id", uid)
    .single();

  if (fetchError) throw new Error(fetchError.message);

  return userData;
};
