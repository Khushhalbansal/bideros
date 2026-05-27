import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Calls tick_auction every second to advance hammer strikes server-side. */
export function useAuctionTicker(tournamentId: string | null | undefined, active: boolean) {
  useEffect(() => {
    if (!tournamentId || !active) return;
    let stopped = false;
    const tick = async () => {
      if (stopped) return;
      try { await supabase.rpc("tick_auction" as never, { p_tournament: tournamentId } as never); } catch {/* ignore */}
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => { stopped = true; clearInterval(i); };
  }, [tournamentId, active]);
}
