import { useEffect, useRef } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../../shared/supabase/supabaseClient";

export function useAutoLogout() {
  const router = useRouter();
  const loggedOut = useRef(false);

  useEffect(() => {
    let channel: any;

    const setup = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const userId = session.user.id;

      channel = supabase
        .channel(`user-status-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "users",
            filter: `id=eq.${userId}`,
          },
          (payload) => {
            const newStatus = payload.new?.status;
            if ((newStatus === "banned" || newStatus === "suspended") && !loggedOut.current) {
              loggedOut.current = true;
              const title = newStatus === "banned" ? "Account Banned" : "Account Suspended";
              const msg =
                newStatus === "banned"
                  ? "Your account has been permanently banned. Contact PNP Calbayog for more information."
                  : "Your account has been temporarily suspended. Contact PNP Calbayog for more information.";
              Alert.alert(title, msg, [
                {
                  text: "OK",
                  onPress: async () => {
                    await supabase.auth.signOut();
                    router.replace("/(tabs)/login" as any);
                  },
                },
              ]);
            }
          },
        )
        .subscribe();
    };

    setup();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);
}
