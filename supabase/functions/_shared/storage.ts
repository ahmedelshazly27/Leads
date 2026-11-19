// Storage helpers for deleting whole folders.
import { admin } from "./supabase.ts";

/** Every object path under `prefix` (recursive). */
export async function listAll(bucket: string, prefix: string): Promise<string[]> {
  const out: string[] = [];
  const queue = [prefix.replace(/\/$/, "")];
  while (queue.length) {
    const dir = queue.shift()!;
    for (let offset = 0;; offset += 1000) {
      const { data, error } = await admin().storage.from(bucket).list(dir, { limit: 1000, offset });
      if (error) throw new Error(`list ${bucket}/${dir}: ${error.message}`);
      for (const entry of data ?? []) {
        const path = dir ? `${dir}/${entry.name}` : entry.name;
        // Folders come back without an id.
        if (entry.id === null) queue.push(path);
        else out.push(path);
      }
      if (!data || data.length < 1000) break;
    }
  }
  return out;
}

/** Removes paths in batches. Returns how many were removed. */
export async function removePaths(bucket: string, paths: string[]): Promise<number> {
  let removed = 0;
  const unique = [...new Set(paths.filter(Boolean))];
  for (let i = 0; i < unique.length; i += 100) {
    const batch = unique.slice(i, i + 100);
    const { data, error } = await admin().storage.from(bucket).remove(batch);
    if (error) throw new Error(`remove ${bucket}: ${error.message}`);
    removed += data?.length ?? 0;
  }
  return removed;
}
