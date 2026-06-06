import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy, Gift, ArrowRight, Share2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Link } from "@tanstack/react-router";

export function ReferralProgram({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<any>(null);
  
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('profiles').select('points, auctions_quota, referral_code').eq('id', userId).single();
      setProfile(data);
    })();
  }, [userId]);

  if (!profile) return null;

  const points = profile.points || 0;
  const quota = profile.auctions_quota || 0;
  const progress = Math.min((points / 120) * 100, 100);
  
  // They might not have a code yet if the migration hasn't run on them
  const link = profile.referral_code 
    ? `${window.location.origin}/auth?ref=${profile.referral_code}` 
    : "Generating your code...";

  const copyLink = () => {
    if (!profile.referral_code) return;
    navigator.clipboard.writeText(link);
    toast.success("Referral link copied!");
  };

  return (
    <div className="bg-glass border border-neon/40 rounded-2xl p-6 md:p-8 relative overflow-hidden shadow-[0_0_30px_rgba(var(--neon),0.1)]">
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-neon/20 rounded-full blur-3xl pointer-events-none" />
      
      <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
        <div className="flex-1 space-y-4">
          <div className="flex items-center gap-2">
            <Gift className="w-6 h-6 text-neon animate-pulse" />
            <h2 className="text-2xl font-bold">Refer & Earn Free Auctions</h2>
          </div>
          <p className="text-muted-foreground text-sm max-w-xl">
            Invite your friends to host tournaments on Bideros. When they buy a Single Tournament pass, you earn <strong className="text-neon">20 points</strong>. Reach 120 points for a free auction! If they buy a Pro Subscription, you instantly get a free auction!
          </p>
          
          <div className="flex items-center gap-2 max-w-md bg-background/50 border border-border rounded-lg p-1 pr-2">
            <input 
              readOnly 
              value={link} 
              className="flex-1 bg-transparent border-none focus:outline-none text-xs px-3 text-muted-foreground" 
            />
            <Button size="sm" onClick={copyLink} className="h-8 shadow-neon" variant="secondary">
              <Copy className="w-3 h-3 mr-1" /> Copy
            </Button>
          </div>
        </div>

        <div className="flex-1 w-full bg-background/50 border border-border rounded-xl p-5 space-y-4">
          <div className="flex justify-between items-end">
            <div>
              <div className="text-sm font-bold text-muted-foreground">Your Points</div>
              <div className="text-3xl font-black text-neon">{points} <span className="text-sm text-muted-foreground font-medium">/ 120</span></div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-muted-foreground">Free Auctions Available</div>
              <div className="text-2xl font-black text-foreground">{quota}</div>
            </div>
          </div>
          
          <Progress value={progress} className="h-2 bg-muted/50" />
          
          <div className="flex justify-between items-center pt-2">
            <span className="text-xs text-muted-foreground">{120 - (points % 120)} points to next free auction</span>
            <Button asChild size="sm" variant="outline" className="h-7 text-xs border-neon/50 text-neon hover:bg-neon/10">
              <Link to="/pricing">Buy More <ArrowRight className="w-3 h-3 ml-1" /></Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
