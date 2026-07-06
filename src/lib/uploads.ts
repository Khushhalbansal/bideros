import { supabase } from "@/integrations/supabase/client";

const ALLOWED = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

export async function uploadImage(bucket: "player-photos" | "tournament-assets", file: File, pathPrefix: string) {
  if (!ALLOWED.includes(file.type)) throw new Error("Only JPG, PNG, or WEBP");
  if (file.size > MAX_BYTES) throw new Error("File too large (max 5MB)");
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${pathPrefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
