import Link from "next/link";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseServer } from "@/lib/supabaseServer";

function getSupabaseAuthServer() {
  const cookieStore = cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("missing_supabase_env_for_auth");

  return createServerClient(url, anon, {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value;
      },
      set(name, value, options) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name, options) {
        cookieStore.set({ name, value: "", ...options });
      },
    },
  });
}

async function getSessionRoleAndCompany() {
  const supabaseAuth = getSupabaseAuthServer();
  const { data } = await supabaseAuth.auth.getUser();
  const user = data?.user;
  if (!user?.id) return { role: "anonymous" as const, company_id: null as string | null };

  // platform role
  const { data: pm } = await supabaseServer
    .from("platform_members")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  const role = String((pm as any)?.role || "company_user");

  // for non-owner: find their company membership (first one)
  let company_id: string | null = null;
  if (role !== "platform_owner") {
    const { data: cm } = await supabaseServer
      .from("company_admins")
      .select("company_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    company_id = (cm as any)?.company_id ? String((cm as any).company_id) : null;
  }

  return { role, company_id };
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      style={{
        padding: "10px 12px",
        borderRadius: 12,
        textDecoration: "none",
        color: "#111",
        border: "1px solid #eee",
        background: "#fff",
        fontSize: 14,
      }}
    >
      {label}
    </Link>
  );
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { role, company_id } = await getSessionRoleAndCompany();

  const isOwner = role === "platform_owner";
  const canCompany = !!company_id;

  return (
    <div style={{ minHeight: "100vh", background: "#f6f7f9", fontFamily: "system-ui" }}>
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: 18,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontWeight: 800 }}>TamTam Admin</div>
          <div style={{ fontSize: 12, opacity: 0.6 }}>
            {isOwner ? "Owner" : canCompany ? "Company Admin" : "No access"}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <NavLink href="/admin" label="Home" />
          {isOwner && <NavLink href="/admin/companies" label="Companies" />}
          {isOwner && <NavLink href="/admin/inbox" label="Global Inbox" />}
          {!isOwner && canCompany && <NavLink href={`/admin/companies/${company_id}`} label="My Company" />}
          {!isOwner && canCompany && <NavLink href={`/admin/companies/${company_id}/leads`} label="Inbox" />}
          {!isOwner && canCompany && <NavLink href={`/admin/companies/${company_id}/conversations`} label="Conversations" />}
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 18px 18px" }}>{children}</div>
    </div>
  );
}
