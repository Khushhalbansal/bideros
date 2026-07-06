import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin/register")({
  validateSearch: (s: Record<string, unknown>) => ({ token: (s.token as string) ?? "" }),
  component: AdminRegisterPage,
});

function scorePassword(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 12) score++;
  if (pw.length >= 16) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 2) return { score: 1, label: "Weak", color: "bg-red-500" };
  if (score <= 3) return { score: 2, label: "Fair", color: "bg-amber-500" };
  return { score: 3, label: "Strong", color: "bg-emerald-500" };
}

function AdminRegisterPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const [validating, setValidating] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  const strength = useMemo(() => scorePassword(password), [password]);

  useEffect(() => {
    (async () => {
      if (!token) { setValidationError("Missing invite token"); setValidating(false); return; }
      const { data, error } = await supabase.rpc("validate_admin_invite", { p_token: token });
      if (error) { setValidationError(error.message); setValidating(false); return; }
      const res = data as { ok: boolean; error?: string; email?: string };
      if (!res.ok) { setValidationError(res.error ?? "Invalid invite"); setValidating(false); return; }
      setEmail(res.email ?? "");
      setValidating(false);
    })();
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 12) return toast.error("Password must be at least 12 characters");
    setBusy(true);
    const { error: suErr } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: name }, emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    if (suErr) { setBusy(false); return toast.error(suErr.message); }

    // Sign in immediately so RPC has auth.uid()
    const { error: siErr } = await supabase.auth.signInWithPassword({ email, password });
    if (siErr) { setBusy(false); return toast.error(siErr.message); }

    const { data, error } = await supabase.rpc("consume_admin_invite", { p_token: token });
    setBusy(false);
    if (error) return toast.error(error.message);
    const res = data as { ok: boolean; error?: string };
    if (!res.ok) return toast.error(res.error ?? "Could not consume invite");
    toast.success("Welcome, admin");
    navigate({ to: "/dashboard" });
  };

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-neon" />
      </div>
    );
  }

  if (validationError) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="container mx-auto py-6 px-4"><Logo /></header>
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-md bg-glass border border-border rounded-2xl p-8">
            <h1 className="text-xl font-bold mb-2">Invite invalid</h1>
            <p className="text-sm text-muted-foreground mb-6">{validationError}</p>
            <Link to="/auth" className="text-sm text-neon hover:underline">← Back to sign in</Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="container mx-auto py-6 px-4"><Logo /></header>
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-glass border border-border rounded-2xl p-8 shadow-neon">
          <h1 className="text-2xl font-bold mb-1">Create admin account</h1>
          <p className="text-sm text-muted-foreground mb-6">Invite verified for <span className="text-neon">{email}</span></p>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label>Full name</Label>
              <Input value={name} onChange={e=>setName(e.target.value)} required />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={email} disabled />
            </div>
            <div>
              <Label>Password</Label>
              <div className="relative">
                <Input type={showPw ? "text" : "password"} value={password}
                  onChange={e=>setPassword(e.target.value)} minLength={12} required />
                <button type="button" onClick={() => setShowPw(s=>!s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPw ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                </button>
              </div>
              {password.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1 h-1.5">
                    {[1,2,3].map(i => (
                      <div key={i} className={`flex-1 rounded ${i <= strength.score ? strength.color : "bg-muted"}`} />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Strength: <span className="font-medium">{strength.label}</span> · min 12 chars
                  </p>
                </div>
              )}
            </div>
            <Button disabled={busy || password.length < 12} className="w-full gradient-neon text-primary-foreground shadow-neon">
              {busy ? "Creating..." : "Create admin account"}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
