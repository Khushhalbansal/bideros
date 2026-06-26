import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

export function usePresence() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Ping immediately when the user becomes active
    supabase.rpc("update_presence").catch(console.error);

    // Then ping every 60 seconds
    const interval = setInterval(() => {
      supabase.rpc("update_presence").catch(console.error);
    }, 60000);

    return () => clearInterval(interval);
  }, [user]);
}
