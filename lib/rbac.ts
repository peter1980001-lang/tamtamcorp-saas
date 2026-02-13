import { supabaseServer } from "@/lib/supabaseServer";
import { requireOwner } from "@/lib/adminGuard";

/**
 * Erwartung:
 * - requireOwner() gibt ok=true wenn Owner eingeloggt ist
 * - Admin-Login nutzt Supabase Auth (auth.uid()) und schreibt Mapping in public.company_admins
 *
 * Wenn du Admin-Login anders gelöst hast, sag kurz wie – dann passe ich das an.
 */

export type RBACResult =
  | { ok: true; role: "owner"; company_ids: null }
  | { ok: true; role: "admin"; company_ids: string[] }
  | { ok: false; status: number; error: string };

export async function requireOwnerOrAdmin(): Promise<RBACResult> {
  // 1) Owner?
  try {
    const o = await requireOwner();
    if (o?.ok) return { ok: true, role: "owner", company_ids: null };
  } catch {
    // ignore
  }

  // 2) Admin? -> auth.uid() via Supabase SQL (RLS Policy erlaubt SELECT nur auf eigene rows)
  // Supabase-JS server client kann auth.uid() nur innerhalb Postgres (Policy/SQL) nutzen.
  // Daher lesen wir einfach company_admins (RLS filtert automatisch auf den eingeloggten User).
  const { data, error } = await supabaseServer
    .from("company_admins")
    .select("company_id")
    .limit(50);

  if (error) return { ok: false, status: 401, error: "forbidden" };

  const company_ids = (data ?? []).map((x: any) => String(x.company_id));
  if (company_ids.length === 0) return { ok: false, status: 401, error: "forbidden" };

  return { ok: true, role: "admin", company_ids };
}
