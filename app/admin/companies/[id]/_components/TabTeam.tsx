"use client";

import { useEffect, useState } from "react";
import type { AdminRow, InviteRow } from "./types";
import { Card, Button, Input, UI } from "./ui";
import { fetchJson, copyToClipboard } from "./api";

export default function TabTeam(props: { companyId: string; isOwner: boolean; setToast: (s: string) => void }) {
  const { companyId, isOwner, setToast } = props;

  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [adminMutating, setAdminMutating] = useState<string | null>(null);

  const [inviteRole, setInviteRole] = useState("admin");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteDays, setInviteDays] = useState(7);
  const [inviteCreating, setInviteCreating] = useState(false);

  async function loadInvites() {
    setLoading(true);
    const { ok, json } = await fetchJson(`/api/admin/companies/${companyId}/invites`, { cache: "no-store" as any });
    setLoading(false);
    if (!ok) return setToast(json?.error || "invites_load_failed");
    setAdmins((json?.admins ?? []) as AdminRow[]);
    setInvites((json?.invites ?? []) as InviteRow[]);
  }

  useEffect(() => {
    void loadInvites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createInvite() {
    setInviteCreating(true);

    const { ok, json } = await fetchJson(`/api/admin/companies/${companyId}/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: inviteRole, email: inviteEmail.trim() || null, expires_days: inviteDays }),
    });

    setInviteCreating(false);
    if (!ok) return setToast(json?.error || "invite_create_failed");

    const inv: InviteRow | null = json?.invite ?? null;
    if (inv?.token) {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const link = `${origin}/invite?token=${encodeURIComponent(inv.token)}`;
      await copyToClipboard(link);
      setToast("Invite link copied");
    } else {
      setToast("Invite created");
    }

    setInviteEmail("");
    setInviteRole("admin");
    setInviteDays(7);
    await loadInvites();
  }

  async function revokeInvite(invite_id: string) {
    const { ok, json } = await fetchJson(`/api/admin/companies/${companyId}/invites?invite_id=${encodeURIComponent(invite_id)}`, { method: "DELETE" });
    if (!ok) return setToast(json?.error || "invite_revoke_failed");
    setToast("Revoked");
    await loadInvites();
  }

  async function setAdminRole(user_id: string, role: string) {
    setAdminMutating(user_id);

    const { ok, json } = await fetchJson(`/api/admin/companies/${companyId}/admins`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id, role }),
    });

    setAdminMutating(null);
    if (!ok) return setToast(json?.error || "admin_role_update_failed");

    setToast("Saved");
    await loadInvites();
  }

  async function removeAdmin(user_id: string) {
    setAdminMutating(user_id);

    const { ok, json } = await fetchJson(`/api/admin/companies/${companyId}/admins?user_id=${encodeURIComponent(user_id)}`, { method: "DELETE" });

    setAdminMutating(null);
    if (!ok) return setToast(json?.error || "admin_remove_failed");

    setToast("Removed");
    await loadInvites();
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Card title="Team" subtitle="Invite colleagues and manage roles." right={<Button onClick={loadInvites} disabled={loading} variant="secondary">{loading ? "Loading…" : "Refresh"}</Button>}>
        {loading ? (
          <div style={{ color: UI.text2 }}>Loading…</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {admins.map((a) => (
              <div key={a.user_id} style={{ display: "grid", gridTemplateColumns: "1fr 170px 120px", gap: 10, alignItems: "center", border: `1px solid ${UI.border}`, borderRadius: UI.radiusLg, padding: 12, background: "#fff" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 1000, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.email || a.user_id}</div>
                  <div style={{ fontSize: 12.5, color: UI.text2 }}>Role: {a.role}</div>
                </div>

                <select value={a.role} onChange={(e) => setAdminRole(a.user_id, e.target.value)} disabled={adminMutating === a.user_id} style={{ padding: "10px 12px", borderRadius: 12, border: `1px solid ${UI.border}`, background: "#fff", fontSize: 13.5 }}>
                  <option value="admin">admin</option>
                  <option value="viewer">viewer</option>
                  {isOwner ? <option value="owner">owner</option> : null}
                </select>

                <Button onClick={() => removeAdmin(a.user_id)} disabled={adminMutating === a.user_id} variant="danger">
                  Remove
                </Button>
              </div>
            ))}
            {admins.length === 0 ? <div style={{ color: UI.text2 }}>No team members found.</div> : null}
          </div>
        )}
      </Card>

      <Card title="Invite" subtitle="Create a secure invite link (copied automatically).">
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 170px 140px 140px", gap: 10 }}>
            <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Email (optional)" />
            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} style={{ padding: "11px 12px", borderRadius: 12, border: `1px solid ${UI.border}`, background: "#fff" }}>
              <option value="admin">admin</option>
              <option value="viewer">viewer</option>
              {isOwner ? <option value="owner">owner</option> : null}
            </select>
            <Input type="number" min={1} max={30} value={inviteDays} onChange={(e) => setInviteDays(Number(e.target.value || 7))} />
            <Button onClick={createInvite} disabled={inviteCreating} variant="primary">
              {inviteCreating ? "Creating…" : "Create invite"}
            </Button>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {invites.map((inv) => (
              <div key={inv.id} style={{ border: `1px solid ${UI.border}`, borderRadius: UI.radiusLg, padding: 12, background: "#fff", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 1000 }}>{inv.email || "(no email)"}</div>
                  <div style={{ fontSize: 12.5, color: UI.text2 }}>
                    Role: {inv.role} · Status: {inv.status} · Expires: {new Date(inv.expires_at).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <Button
                    onClick={async () => {
                      const origin = typeof window !== "undefined" ? window.location.origin : "";
                      const link = `${origin}/invite?token=${encodeURIComponent(inv.token)}`;
                      await copyToClipboard(link);
                      setToast("Copied");
                    }}
                    variant="secondary"
                  >
                    Copy link
                  </Button>
                  <Button onClick={() => revokeInvite(inv.id)} variant="danger" disabled={inv.status === "revoked"}>
                    Revoke
                  </Button>
                </div>
              </div>
            ))}
            {invites.length === 0 ? <div style={{ color: UI.text2 }}>No invites.</div> : null}
          </div>
        </div>
      </Card>
    </div>
  );
}