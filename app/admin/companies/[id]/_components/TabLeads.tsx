"use client";

import { useEffect, useMemo, useState } from "react";
import type { LeadRow } from "./types";
import { Card, Button, Input, Modal, Textarea, CodeBox, UI } from "./ui";
import { fetchJson } from "./api";

function safeJsonStringify(v: any) {
  try {
    return JSON.stringify(v ?? {}, null, 2);
  } catch {
    return "{}";
  }
}

export default function TabLeads(props: { companyId: string; setToast: (s: string) => void }) {
  const { companyId, setToast } = props;

  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [leadQuery, setLeadQuery] = useState("");
  const [leadBand, setLeadBand] = useState<"all" | "cold" | "warm" | "hot">("all");
  const [leadStatus, setLeadStatus] = useState<"all" | "new" | "contacted" | "closed">("all");
  const [leadLimit, setLeadLimit] = useState(50);
  const [leadSort, setLeadSort] = useState<"last_touch" | "updated" | "score">("last_touch");

  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRow, setPreviewRow] = useState<LeadRow | null>(null);
  const [previewMessages, setPreviewMessages] = useState<{ role: string; content: string; created_at: string }[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<LeadRow | null>(null);
  const [editStatus, setEditStatus] = useState<"new" | "contacted" | "closed">("new");
  const [editAssignedTo, setEditAssignedTo] = useState<string>("");
  const [editNotes, setEditNotes] = useState<string>("");
  const [editTags, setEditTags] = useState<string>("");
  const [editSaving, setEditSaving] = useState(false);

  const visibleLeads = useMemo(() => leads, [leads]);

  async function loadLeads() {
    setLoading(true);

    const qs = new URLSearchParams({
      q: leadQuery || "",
      band: leadBand,
      status: leadStatus,
      limit: String(leadLimit || 50),
      sort: leadSort,
    }).toString();

    const { ok, json } = await fetchJson(`/api/admin/companies/${companyId}/leads?${qs}`, { cache: "no-store" as any });
    setLoading(false);

    if (!ok) return setToast(json?.error || "leads_failed");

    setLeads((json?.leads ?? []) as LeadRow[]);
    setSelectedLeadIds(new Set());
  }

  useEffect(() => {
    void loadLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleSelectLead(leadId: string) {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  }

  function selectAllVisibleLeads() {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      for (const r of visibleLeads) next.add(r.id);
      return next;
    });
  }

  function clearLeadSelection() {
    setSelectedLeadIds(new Set());
  }

  async function bulkDeleteSelectedLeads() {
    const ids = Array.from(selectedLeadIds);
    if (!ids.length) return setToast("No leads selected");

    const okConfirm = window.confirm(`Delete ${ids.length} lead(s)? This cannot be undone.`);
    if (!okConfirm) return;

    const { ok, json } = await fetchJson(`/api/admin/companies/${companyId}/leads`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });

    if (!ok) return setToast(json?.error || "bulk_delete_failed");

    setToast(`Deleted ${json?.deleted ?? ids.length}`);
    await loadLeads();
  }

  async function deleteLead(row: LeadRow) {
    const okConfirm = window.confirm("Delete this lead? This cannot be undone.");
    if (!okConfirm) return;

    const { ok, json } = await fetchJson(`/api/admin/companies/${companyId}/leads`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [row.id] }),
    });

    if (!ok) return setToast(json?.error || "lead_delete_failed");

    setToast("Deleted");
    await loadLeads();
  }

  async function openPreview(row: LeadRow) {
    setPreviewRow(row);
    setPreviewOpen(true);
    setPreviewMessages([]);
    setPreviewLoading(true);

    const { ok, json } = await fetchJson(`/api/admin/companies/${companyId}/leads/${encodeURIComponent(row.id)}/conversation`, { cache: "no-store" as any });
    setPreviewLoading(false);

    if (!ok) {
      setToast(json?.error || "lead_preview_failed");
      return;
    }

    const msgs = (json?.messages ?? []).map((m: any) => ({
      role: String(m?.role || ""),
      content: String(m?.content || ""),
      created_at: String(m?.created_at || ""),
    }));
    setPreviewMessages(msgs);
    if (json?.lead) setPreviewRow(json.lead as LeadRow);
  }

  function openEdit(row: LeadRow) {
    setEditRow(row);
    setEditOpen(true);
    setEditStatus((row.status as any) === "contacted" || (row.status as any) === "closed" ? (row.status as any) : "new");
    setEditAssignedTo(row.assigned_to || "");
    setEditNotes(row.admin_notes || "");
    setEditTags((row.tags || []).join(", "));
  }

  async function saveEdit() {
    if (!editRow) return;
    setEditSaving(true);

    const tags = (editTags || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 50);

    const { ok, json } = await fetchJson(`/api/admin/companies/${companyId}/leads`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editRow.id,
        status: editStatus,
        assigned_to: editAssignedTo.trim() || null,
        admin_notes: editNotes.trim() || null,
        tags,
      }),
    });

    setEditSaving(false);
    if (!ok) return setToast(json?.error || "lead_update_failed");

    setToast("Saved");
    setEditOpen(false);
    setEditRow(null);
    await loadLeads();
  }

  return (
    <Card title="Leads" subtitle="Qualified leads captured by your widget." right={<Button onClick={loadLeads} disabled={loading} variant="secondary">{loading ? "Loading…" : "Refresh"}</Button>}>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 160px 160px 140px 120px 120px", gap: 10 }}>
          <Input value={leadQuery} onChange={(e) => setLeadQuery(e.target.value)} placeholder="Search…" />
          <select value={leadBand} onChange={(e) => setLeadBand(e.target.value as any)} style={{ padding: "11px 12px", borderRadius: 12, border: `1px solid ${UI.border}`, background: "#fff" }}>
            <option value="all">all</option><option value="cold">cold</option><option value="warm">warm</option><option value="hot">hot</option>
          </select>
          <select value={leadStatus} onChange={(e) => setLeadStatus(e.target.value as any)} style={{ padding: "11px 12px", borderRadius: 12, border: `1px solid ${UI.border}`, background: "#fff" }}>
            <option value="all">all</option><option value="new">new</option><option value="contacted">contacted</option><option value="closed">closed</option>
          </select>
          <select value={leadSort} onChange={(e) => setLeadSort(e.target.value as any)} style={{ padding: "11px 12px", borderRadius: 12, border: `1px solid ${UI.border}`, background: "#fff" }}>
            <option value="last_touch">last_touch</option><option value="updated">updated</option><option value="score">score</option>
          </select>
          <Input type="number" min={10} max={500} value={leadLimit} onChange={(e) => setLeadLimit(Number(e.target.value || 50))} />
          <Button onClick={loadLeads} disabled={loading} variant="primary">Apply</Button>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ fontSize: 12.5, color: UI.text2 }}>
            Showing <b>{visibleLeads.length}</b> · Selected <b>{selectedLeadIds.size}</b>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button onClick={selectAllVisibleLeads} disabled={visibleLeads.length === 0} variant="secondary">Select visible</Button>
            <Button onClick={clearLeadSelection} disabled={selectedLeadIds.size === 0} variant="secondary">Clear</Button>
            <Button onClick={bulkDeleteSelectedLeads} disabled={selectedLeadIds.size === 0} variant="danger">Delete selected</Button>
          </div>
        </div>

        <div style={{ border: `1px solid ${UI.border}`, borderRadius: UI.radiusLg, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "42px 2.4fr 110px 90px 120px 160px 160px 190px", background: UI.surface2, padding: "10px 12px", fontSize: 12.5, color: UI.text2, fontWeight: 1000, gap: 10, alignItems: "center" }}>
            <div>✓</div><div>Lead</div><div>Band</div><div>Score</div><div>Status</div><div>Assigned</div><div>Updated</div><div>Actions</div>
          </div>

          {visibleLeads.length === 0 ? (
            <div style={{ padding: 12, color: UI.text2 }}>No leads found.</div>
          ) : (
            visibleLeads.map((l) => {
              const isSel = selectedLeadIds.has(l.id);
              const preview =
                (l.lead_preview || "").trim() ||
                [l.email || "", l.phone || "", String(l?.qualification_json?.use_case || "").trim(), String(l?.qualification_json?.note || "").trim()]
                  .filter(Boolean)
                  .join(" · ")
                  .slice(0, 180);

              return (
                <div key={l.id} style={{ display: "grid", gridTemplateColumns: "42px 2.4fr 110px 90px 120px 160px 160px 190px", padding: "10px 12px", borderTop: `1px solid ${UI.border}`, gap: 10, alignItems: "center", background: isSel ? "#F8FAFF" : "#fff" }}>
                  <div><input type="checkbox" checked={isSel} onChange={() => toggleSelectLead(l.id)} /></div>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 1000, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name || l.email || l.phone || "(unknown)"}</div>
                    <div style={{ fontSize: 12.5, color: UI.text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preview || l.conversation_id || l.id}</div>
                  </div>

                  <div style={{ fontSize: 12.5, color: UI.text2, textTransform: "uppercase" }}>{l.score_band}</div>
                  <div style={{ fontWeight: 1000 }}>{l.score_total}</div>
                  <div style={{ fontSize: 12.5, color: UI.text2, textTransform: "uppercase" }}>{String(l.status || "new")}</div>
                  <div style={{ fontSize: 12.5, color: UI.text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.assigned_to || "—"}</div>
                  <div style={{ fontSize: 12.5, color: UI.text2 }}>{new Date(l.updated_at).toLocaleString()}</div>

                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button type="button" onClick={() => openPreview(l)} style={{ border: `1px solid ${UI.border}`, background: "#fff", borderRadius: 999, padding: "7px 10px", fontSize: 12.5, cursor: "pointer", fontWeight: 1000 }}>Preview</button>
                    <button type="button" onClick={() => openEdit(l)} style={{ border: `1px solid ${UI.border}`, background: "#fff", borderRadius: 999, padding: "7px 10px", fontSize: 12.5, cursor: "pointer", fontWeight: 1000 }}>Edit</button>
                    <button type="button" onClick={() => deleteLead(l)} style={{ border: "1px solid #FECACA", background: "#fff", color: UI.danger, borderRadius: 999, padding: "7px 10px", fontSize: 12.5, cursor: "pointer", fontWeight: 1000 }}>Delete</button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Preview modal */}
      {previewOpen && previewRow ? (
        <Modal
          title="Preview Lead"
          onClose={() => {
            setPreviewOpen(false);
            setPreviewRow(null);
            setPreviewMessages([]);
          }}
          right={
            <Button
              onClick={() => {
                setPreviewOpen(false);
                openEdit(previewRow);
              }}
              variant="primary"
            >
              Edit
            </Button>
          }
        >
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ border: `1px solid ${UI.border}`, borderRadius: UI.radiusLg, padding: 12, background: "#fff" }}>
                <div style={{ fontSize: 12.5, color: UI.text2 }}>Lead</div>
                <div style={{ fontWeight: 1000, marginTop: 6 }}>{previewRow.name || previewRow.email || previewRow.phone || "(unknown)"}</div>
                <div style={{ fontSize: 12.5, color: UI.text2, marginTop: 8 }}>
                  <b>Band:</b> {previewRow.score_band.toUpperCase()} · <b>Score:</b> {previewRow.score_total} · <b>Status:</b> {String(previewRow.status || "new")}
                </div>
                <div style={{ fontSize: 12.5, color: UI.text2, marginTop: 8 }}>
                  <b>Email:</b> {previewRow.email || "—"} · <b>Phone:</b> {previewRow.phone || "—"}
                </div>
              </div>

              <div style={{ border: `1px solid ${UI.border}`, borderRadius: UI.radiusLg, padding: 12, background: "#fff" }}>
                <div style={{ fontSize: 12.5, color: UI.text2 }}>Meta</div>
                <div style={{ fontSize: 12.5, color: UI.text2, marginTop: 8 }}>
                  <b>Assigned:</b> {previewRow.assigned_to || "—"}
                </div>
                <div style={{ fontSize: 12.5, color: UI.text2, marginTop: 8 }}>
                  <b>Last touch:</b> {previewRow.last_touch_at ? new Date(previewRow.last_touch_at).toLocaleString() : "—"}
                </div>
                <div style={{ fontSize: 12.5, color: UI.text2, marginTop: 8 }}>
                  <b>Conversation:</b> {previewRow.conversation_id || "—"}
                </div>
              </div>
            </div>

            <div style={{ border: `1px solid ${UI.border}`, borderRadius: UI.radiusLg, padding: 12, background: "#fff" }}>
              <div style={{ fontSize: 12.5, color: UI.text2, marginBottom: 10 }}>
                <b>Tags:</b> {(previewRow.tags || []).join(", ") || "—"}
              </div>
              <div style={{ fontSize: 12.5, color: UI.text2, marginBottom: 10 }}>
                <b>Admin notes:</b> {previewRow.admin_notes || "—"}
              </div>

              <div style={{ fontSize: 12.5, color: UI.text2 }}><b>Qualification</b></div>
              <CodeBox text={safeJsonStringify(previewRow.qualification_json || {})} />
            </div>

            <div style={{ border: `1px solid ${UI.border}`, borderRadius: UI.radiusLg, overflow: "hidden" }}>
              <div style={{ background: UI.surface2, padding: "10px 12px", fontSize: 12.5, color: UI.text2, fontWeight: 1000 }}>
                Conversation (latest {previewMessages.length})
              </div>

              {previewLoading ? (
                <div style={{ padding: 12, color: UI.text2 }}>Loading…</div>
              ) : previewMessages.length === 0 ? (
                <div style={{ padding: 12, color: UI.text2 }}>No messages found.</div>
              ) : (
                <div style={{ padding: 12, display: "grid", gap: 10 }}>
                  {previewMessages.map((m, idx) => (
                    <div key={idx} style={{ border: `1px solid ${UI.borderSoft}`, borderRadius: UI.radiusLg, padding: 10, background: "#fff" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                        <div style={{ fontWeight: 1000, fontSize: 12.5, color: m.role === "assistant" ? "#1D4ED8" : UI.text }}>{m.role}</div>
                        <div style={{ fontSize: 12, color: UI.text3 }}>{m.created_at ? new Date(m.created_at).toLocaleString() : ""}</div>
                      </div>
                      <div style={{ marginTop: 6, fontSize: 13.5, color: UI.text, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{m.content}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      ) : null}

      {/* Edit modal */}
      {editOpen && editRow ? (
        <Modal
          title="Edit Lead"
          onClose={() => {
            setEditOpen(false);
            setEditRow(null);
          }}
          right={
            <Button onClick={saveEdit} disabled={editSaving} variant="primary">
              {editSaving ? "Saving…" : "Save"}
            </Button>
          }
        >
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={{ fontSize: 12.5, color: UI.text2, marginBottom: 6 }}>Status</div>
                <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as any)} style={{ width: "100%", padding: "11px 12px", borderRadius: 12, border: `1px solid ${UI.border}`, background: "#fff" }}>
                  <option value="new">new</option>
                  <option value="contacted">contacted</option>
                  <option value="closed">closed</option>
                </select>
              </div>

              <div>
                <div style={{ fontSize: 12.5, color: UI.text2, marginBottom: 6 }}>Assigned to</div>
                <Input value={editAssignedTo} onChange={(e) => setEditAssignedTo(e.target.value)} placeholder="Employee / agent name or id" />
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12.5, color: UI.text2, marginBottom: 6 }}>Tags (comma separated)</div>
              <Input value={editTags} onChange={(e) => setEditTags(e.target.value)} placeholder="vip, german, wants-demo" />
            </div>

            <div>
              <div style={{ fontSize: 12.5, color: UI.text2, marginBottom: 6 }}>Admin notes</div>
              <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} style={{ minHeight: 220 }} placeholder="Internal notes…" />
            </div>

            <div style={{ fontSize: 12.5, color: UI.text3 }}>Lead ID: {editRow.id}</div>
          </div>
        </Modal>
      ) : null}
    </Card>
  );
}