import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({ component: ResetPassword });

function ResetPassword() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="container mx-auto py-6 px-4"><Logo /></header>
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-glass border border-border rounded-2xl p-8 shadow-neon">
          <h1 className="text-2xl font-bold mb-1">Set new password</h1>
          <p className="text-sm text-muted-foreground mb-6">Choose a new password for your account.</p>
          <form onSubmit={submit} className="space-y-4">
            <div><Label>New password</Label><Input type="password" value={pw} onChange={e=>setPw(e.target.value)} required minLength={8} /></div>
            <Button disabled={busy} className="w-full gradient-neon text-primary-foreground shadow-neon">
              {busy ? "Updating..." : "Update password"}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground text-center mt-6">
            <Link to="/auth" className="hover:text-neon">← Back to sign in</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
