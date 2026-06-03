import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { uploadImage } from "@/lib/uploads";
import { parseINR } from "@/lib/format";
import { toast } from "sonner";

interface Props {
  tournamentId: string;
  startOrder: number;
  categories: { id: string; name: string }[];
  onDone: () => void;
}

const NONE = "__none__";

/** Powerful bulk import:
 * - paste CSV/TSV OR upload a .csv file (any column order)
 * - optional header row; user maps which column = name / role / base / photo / category
 * - optional: upload a "photo folder" (multi-file) — rows reference filenames in the photo column and we upload + match
 */
export function BulkImportPlayers({ tournamentId, startOrder, categories, onDone }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [delim, setDelim] = useState<"," | "\t" | "|">(",");
  const [hasHeader, setHasHeader] = useState(true);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [map, setMap] = useState<{ name: number; role: number; base: number; photo: number; category: number }>({
    name: 0, role: 1, base: 2, photo: -1, category: -1,
  });

  const rows = useMemo(() => {
    return text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => l.split(delim).map(s => s.trim()));
  }, [text, delim]);
  const header = hasHeader && rows.length > 0 ? rows[0] : null;
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const columnCount = rows[0]?.length ?? 0;

  const onCsvFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result || "");
      setText(s);
      // auto-detect delimiter
      const firstLine = s.split(/\r?\n/)[0] || "";
      if (firstLine.includes("\t")) setDelim("\t");
      else if (firstLine.includes("|")) setDelim("|");
      else setDelim(",");
      setOpen(true);
    };
    reader.readAsText(file);
  };

  const run = async () => {
    if (dataRows.length === 0) return toast.error("No data rows");
    setBusy(true);
    try {
      // pre-upload photos by filename (if a photo column is mapped & files provided)
      const photoMap = new Map<string, string>();
      if (map.photo >= 0 && photoFiles.length > 0) {
        for (const f of photoFiles) {
          try {
            const url = await uploadImage("player-photos", f, `bulk/${tournamentId}`);
            photoMap.set(f.name.toLowerCase(), url);
            // also store basename without extension
            const base = f.name.toLowerCase().replace(/\.[^.]+$/, "");
            photoMap.set(base, url);
          } catch (e) {
            console.warn("photo upload failed", f.name, e);
          }
        }
      }
      const catByName = new Map(categories.map(c => [c.name.toLowerCase(), c.id]));
      const inserts = dataRows.map((cells, i) => {
        const get = (idx: number) => (idx >= 0 ? (cells[idx] || "").trim() : "");
        const name = get(map.name) || `Player ${i + 1}`;
        const role = get(map.role) || "Batter";
        const basePrice = parseINR(get(map.base) || "1 L") || 100000;
        const photoRef = get(map.photo).toLowerCase();
        const photo_url = photoRef ? (photoMap.get(photoRef) || photoMap.get(photoRef.replace(/\.[^.]+$/, "")) || null) : null;
        const catRef = get(map.category).toLowerCase();
        const category_id = catRef ? catByName.get(catRef) ?? null : null;
        return {
          tournament_id: tournamentId, name, role, base_price: basePrice,
          auction_order: startOrder + i + 1,
          photo_url, category_id,
        };
      });
      const { error } = await supabase.from("players").insert(inserts);
      if (error) throw error;
      toast.success(`Imported ${inserts.length} players${photoMap.size ? ` • ${photoMap.size} photos matched` : ""}`);
      setText(""); setPhotoFiles([]); setOpen(false);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally { setBusy(false); }
  };

  const colOptions = Array.from({ length: Math.max(columnCount, 1) }, (_, i) => i);
  const fieldSelect = (label: string, value: number, onChange: (n: number) => void, optional = false) => (
    <div>
      <Label className="text-xs">{label}{!optional && <span className="text-hot">*</span>}</Label>
      <Select value={String(value)} onValueChange={v => onChange(Number(v))}>
        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
        <SelectContent>
          {optional && <SelectItem value="-1">— Not in file —</SelectItem>}
          {colOptions.map(i => (
            <SelectItem key={i} value={String(i)}>
              Column {i + 1}{header?.[i] ? ` · ${header[i]}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <>
      <div className="bg-glass border border-border rounded-xl p-5 space-y-2">
        <h3 className="font-bold text-sm flex items-center gap-2"><Upload className="h-4 w-4" />Bulk import</h3>
        <p className="text-xs text-muted-foreground">Upload your own CSV with any columns. Map them in the next step. Add a folder of photos to match by filename.</p>
        <Button variant="outline" size="sm" className="w-full" onClick={() => setOpen(true)}><FileSpreadsheet className="h-3 w-3 mr-1" />Paste / configure</Button>
        <label className="block">
          <input type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onCsvFile(f); e.currentTarget.value = ""; }} />
          <span className="cursor-pointer block w-full text-center text-xs py-2 rounded-md border border-dashed border-border hover:border-neon hover:text-neon">Upload .csv file</span>
        </label>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border max-w-3xl">
          <DialogHeader><DialogTitle>Bulk import players</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-3 gap-3 items-end">
              <div>
                <Label className="text-xs">Delimiter</Label>
                <Select value={delim} onValueChange={(v) => setDelim(v as "," | "\t" | "|")}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value=",">Comma (,)</SelectItem>
                    <SelectItem value={"\t"}>Tab</SelectItem>
                    <SelectItem value="|">Pipe (|)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={hasHeader} onChange={e => setHasHeader(e.target.checked)} />
                First row is a header
              </label>
              <div className="text-xs text-muted-foreground text-right">
                {dataRows.length} data row{dataRows.length === 1 ? "" : "s"} · {columnCount} column{columnCount === 1 ? "" : "s"}
              </div>
            </div>

            <Textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={8}
              className="font-mono text-xs"
              placeholder={"Name,Role,Base price,Photo,Category\nVirat Kohli,Batter,2 Cr,virat.jpg,Marquee\nJasprit Bumrah,Bowler,2 Cr,bumrah.jpg,Marquee"}
            />

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-glass border border-border rounded-lg p-3">
              {fieldSelect("Name", map.name, n => setMap({ ...map, name: n }))}
              {fieldSelect("Role", map.role, n => setMap({ ...map, role: n }), true)}
              {fieldSelect("Base price", map.base, n => setMap({ ...map, base: n }), true)}
              {fieldSelect("Photo", map.photo, n => setMap({ ...map, photo: n }), true)}
              {fieldSelect("Category", map.category, n => setMap({ ...map, category: n }), true)}
            </div>

            {map.photo >= 0 && (
              <div className="bg-glass border border-neon/30 rounded-lg p-3 space-y-2">
                <Label className="text-xs">Photo folder — pick all images, we'll match by filename in the photo column</Label>
                <Input type="file" accept="image/jpeg,image/png,image/webp" multiple
                  onChange={e => setPhotoFiles(Array.from(e.target.files || []))} />
                {photoFiles.length > 0 && (
                  <p className="text-[10px] text-muted-foreground">{photoFiles.length} photos selected · max 5MB each</p>
                )}
              </div>
            )}

            {dataRows.length > 0 && (
              <div className="text-xs">
                <div className="text-muted-foreground mb-1">Preview (first 3 rows)</div>
                <div className="bg-card/60 border border-border rounded-md p-2 space-y-1 font-mono text-[11px]">
                  {dataRows.slice(0, 3).map((r, i) => (
                    <div key={i} className="truncate">
                      <span className="text-neon">{r[map.name] || "?"}</span>
                      {map.role >= 0 && <> · {r[map.role]}</>}
                      {map.base >= 0 && <> · {r[map.base]}</>}
                      {map.photo >= 0 && <> · 📷 {r[map.photo] || "—"}</>}
                      {map.category >= 0 && <> · 🏷 {r[map.category] || "—"}</>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={busy || dataRows.length === 0} onClick={run} className="gradient-neon text-primary-foreground shadow-neon">
              {busy ? "Importing…" : `Import ${dataRows.length} players`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Silence "unused export" warning for NONE constant; reserved for future filter use
export const _NONE = NONE;
