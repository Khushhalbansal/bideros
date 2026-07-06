import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatINR, parseINR } from "@/lib/format";
import { Trash2, Save, Tag } from "lucide-react";

export interface Category {
  id: string; tournament_id: string; name: string;
  base_price: number; min_bid_increment: number; sort_order: number;
}

export function CategoriesTab({ tournamentId, defaultBase, defaultIncrement }: { tournamentId: string; defaultBase: number; defaultIncrement: number; }) {
  const [items, setItems] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [base, setBase] = useState(formatINR(defaultBase));
  const [incr, setIncr] = useState(formatINR(defaultIncrement));
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("player_categories")
      .select("*").eq("tournament_id", tournamentId).order("sort_order").order("created_at");
    setItems((data as Category[]) || []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tournamentId]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("player_categories").insert({
      tournament_id: tournamentId, name: name.trim(),
      base_price: parseINR(base) || defaultBase,
      min_bid_increment: parseINR(incr) || defaultIncrement,
      sort_order: items.length,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setName(""); load();
  };

  const update = async (id: string, patch: Partial<Category>) => {
    const { error } = await supabase.from("player_categories").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete category? Players will become uncategorised (default tournament base/increment).")) return;
    await supabase.from("player_categories").delete().eq("id", id);
    load();
  };

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <form onSubmit={add} className="bg-glass border border-border rounded-xl p-5 space-y-3 h-fit">
        <h3 className="font-bold flex items-center gap-2"><Tag className="h-4 w-4 text-neon" />Add category</h3>
        <p className="text-xs text-muted-foreground">Categories are optional. Players in a category share the same base price and bid increment.</p>
        <div><Label>Name</Label><Input value={name} onChange={e=>setName(e.target.value)} placeholder="Marquee / A / B / Uncapped" required /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Base price</Label><Input value={base} onChange={e=>setBase(e.target.value)} placeholder="2 Cr" /></div>
          <div><Label>Increment</Label><Input value={incr} onChange={e=>setIncr(e.target.value)} placeholder="20 L" /></div>
        </div>
        <Button disabled={busy} className="w-full gradient-neon text-primary-foreground shadow-neon">Add category</Button>
      </form>

      <div className="md:col-span-2 space-y-2">
        {items.length === 0 && (
          <div className="bg-glass border border-dashed border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
            No categories yet — all players will be treated as a single "General" pool with the tournament default base price and bid increment.
          </div>
        )}
        {items.map(c => (
          <div key={c.id} className="bg-glass border border-border rounded-xl p-3 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
            <Input defaultValue={c.name} onBlur={e => { if (e.target.value !== c.name) update(c.id, { name: e.target.value }); }} className="h-8 text-sm font-semibold" />
            <Input defaultValue={String(c.base_price)} onBlur={e => { const v = parseINR(e.target.value); if (v && v !== c.base_price) update(c.id, { base_price: v }); }} className="h-8 text-xs font-mono w-28" />
            <Input defaultValue={String(c.min_bid_increment)} onBlur={e => { const v = parseINR(e.target.value); if (v && v !== c.min_bid_increment) update(c.id, { min_bid_increment: v }); }} className="h-8 text-xs font-mono w-28" />
            <Button size="sm" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="h-3 w-3" /></Button>
            <div className="col-span-full text-[10px] text-muted-foreground -mt-1">
              Base {formatINR(c.base_price)} · Increment {formatINR(c.min_bid_increment)}
            </div>
          </div>
        ))}
        {items.length > 0 && (
          <p className="text-[10px] text-muted-foreground pt-2 flex items-center gap-1"><Save className="h-3 w-3" />Click any field to edit. Changes save on blur.</p>
        )}
      </div>
    </div>
  );
}
