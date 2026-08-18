import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "@shared/supabase/supabaseClient";

interface PoliceProfile {
  id: string;
  full_name: string;
  badge_id: string;
  rank: string;
  station: string;
  phone_number: string | null;
  police_id_photo_url: string | null;
  photo_url: string | null;
}

interface AuthContextType {
  user: any;
  profile: PoliceProfile | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (data: SignUpData) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export interface SignUpData {
  fullName: string;
  badgeId: string;
  rank: string;
  station: string;
  email: string;
  password: string;
  phoneNumber: string;
  policeIdPhotoUri: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<PoliceProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      setIsLoading(false);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setProfile(null);
    });
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("police_profiles")
      .select("*")
      .eq("id", userId)
      .single();
    setProfile(data);
  };

  const refreshProfile = async () => {
    if (!user) return;
    await fetchProfile(user.id);
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (data: SignUpData) => {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
    });
    if (authError) throw authError;
    if (!authData.user) throw new Error("Sign up failed");

    let policeIdPhotoUrl: string | null = null;
    if (data.policeIdPhotoUri) {
      const response = await fetch(data.policeIdPhotoUri);
      const blob = await response.blob();
      const filename = `police-id-${authData.user.id}-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("police-ids")
        .upload(filename, blob, { contentType: "image/jpeg" });
      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from("police-ids")
          .getPublicUrl(filename);
        policeIdPhotoUrl = urlData.publicUrl;
      }
    }

    const { error: profileError } = await supabase.from("police_profiles").insert({
      id: authData.user.id,
      full_name: data.fullName,
      badge_id: data.badgeId,
      rank: data.rank,
      station: data.station,
      phone_number: data.phoneNumber,
      police_id_photo_url: policeIdPhotoUrl,
    });
    if (profileError) throw profileError;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, profile, isLoading, signIn, signUp, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
