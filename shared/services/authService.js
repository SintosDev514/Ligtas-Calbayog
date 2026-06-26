import { supabase } from "../supabase/supabaseClient";

export const registerResident = async (data) => {
  const { email, password, idPhotoUri, ...profile } = data;

  // 1. Create the auth user
  const { data: authData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (signUpError) throw new Error(signUpError.message);

  const uid = authData.user?.id;
  if (!uid) throw new Error("Failed to create user account.");

  // 2. Upload ID photo if provided
  let idPhotoURL = null;
  if (idPhotoUri) {
    try {
      const response = await fetch(idPhotoUri);
      const blob = await response.blob();
      const filePath = `ids/${uid}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("profile-photos")
        .upload(filePath, blob, { contentType: "image/jpeg", upsert: true });
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from("profile-photos").getPublicUrl(filePath);
        idPhotoURL = urlData?.publicUrl ?? null;
      }
    } catch (err) {
      console.warn("ID photo upload failed:", err);
    }
  }

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
      guardian_name: profile.guardianName || null,
      guardian_phone: profile.guardianPhone || null,
      father_name: profile.fatherName || null,
      father_phone: profile.fatherPhone || null,
      mother_name: profile.motherName || null,
      mother_phone: profile.motherPhone || null,
      latitude: profile.latitude || null,
      longitude: profile.longitude || null,
      id_photo_url: idPhotoURL,
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
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!userData) throw new Error("User account not found. Please contact support.");

  return userData;
};
