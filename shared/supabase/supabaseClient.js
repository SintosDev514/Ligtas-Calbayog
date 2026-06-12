import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://rgqmuuxmucgbxrjjxsvh.supabase.co";
const SUPABASE_ANON_KEY =
  "sb_publishable_u0FuERFW0mCtzknOQd19kA_55jVUKnx";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
