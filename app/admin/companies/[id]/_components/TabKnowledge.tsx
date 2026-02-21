"use client";

import { useEffect, useMemo, useState } from "react";
import type { BrandHints, DetailResponse, KbPage, KnowledgeChunkRow } from "./types";
import { Card, Button, Input, Textarea, CodeBox, Modal, UI } from "./ui";
import { fetchJson } from "./api";

function safeJsonStringify(v: any) {
  try {
    return JSON.stringify(v ?? {}, null, 2);
  } catch {
    return "{}";
  }
}
function normalizeUrlInput(raw: string) {
  const t = String(raw || "").trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return "https://" + t.replace(/^\/+/, "");
}

export default function TabKnowledge(props: {
  companyId: string;
  data: DetailResponse;
  setData: (updater: any) => void;
  isOwner: boolean;
  setToast: (s: string) => void;
}) {
  const { companyId, setData, setToast } = props;

  const [kbPages, setKbPages] = useState<KbPage[]>([]);
  const [kbPageUrl, setKbPageUrl] = useState("");
  const [kbPageTitle, setKbPageTitle] = useState("");
  const [kbPageText, setKbPageText] = useState("");
  const [kbPersistProfile, setKbPersistProfile] = useState(true);

  const [kbFetching, setKbFetching] = useState(false);
  const [kbFetchResult, setKbFetchResult] = useState<any>(null);
  const [kbBrandHints, setKbBrandHints] = useState<BrandHints | null>(null);

  const [kbAuditRunning, setKbAuditRunning] = useState(false);
  const [kbAuditResult, setKbAuditResult] = useState<any>(null);

  const [kbChunks, setKbChunks] = useState<KnowledgeChunkRow[]>([]);
  const [kbChunksLoading, setKbChunksLoading] = useState(false);
  const [kbChunksQuery, setKbChunksQuery] = useState("");
  const [kbChunksLimit, setKbChunksLimit] = useState(50);
  const [kbTypeFilter, setKbTypeFilter] = useState<string>("all");
  const [kbConfFilter, setKbConfFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRow, setPreviewRow] = useState<KnowledgeChunkRow | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<KnowledgeChunkRow | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // manual ingest
  const [kbTitle, setKbTitle] = useState("Manual Admin Entry");
  const [kbText, setKbText] = useState("");
  const [kbIngesting, setKbIngesting] = useState(false);

  async function loadKnowledgeChunks() {
    setKbChunksLoading(true);

    const qs = new URLSearchParams({
      company_id: String(companyId),
      q: kbChunksQuery || "",
      limit: String(kbChunksLimit || 50),
    }).toString();

    const { ok, json } = await fetchJson(`/api/admin/knowledge/chunks?${qs}`, { cache: "no-store" as any });
    setKbChunksLoading(false);
    if (!ok) return setToast(json?.error || "chunks_load_failed");

    setKbChunks((json?.chunks ?? []) as KnowledgeChunkRow[]);
    setSelectedIds(new Set());
  }

  useEffect(() => {
    void loadKnowledgeChunks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allTypes = useMemo(() => {
    const s = new Set<string>();
    for (const c of kbChunks) s.add(String(c?.metadata?.type || "other"));
    return ["all", ...Array.from(s).sort()];
  }, [kbChunks]);

  const allConfs = useMemo(() => {
    const s = new Set<string>();
    for (const c of kbChunks) s.add(String(c?.metadata?.confidence || "medium"));
    return ["all", ...Array.from(s).sort()];
  }, [kbChunks]);

  const visibleChunks = useMemo(() => {
    return kbChunks.filter((c) => {
      const type = String(c?.metadata?.type || "other");
      const conf = String(c?.metadata?.confidence || "medium");
      if (kbTypeFilter !== "all" && type !== kbTypeFilter) return false;
      if (kbConfFilter !== "all" && conf !== kbConfFilter) return false;
      return true;
    });
  }, [kbChunks, kbTypeFilter, kbConfFilter]);

  async function fetchPageIntoForm() {
    const u = normalizeUrlInput(kbPageUrl);
    if (!u) return setToast("Enter a page URL");

    setKbFetching(true);
    setKbFetchResult(null);

    const { ok, json } = await fetchJson("/api/admin/knowledge/fetch-page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: u }),
    });

    setKbFetching(false);
    setKbFetchResult(json);

    if (!ok) return setToast(json?.error || "fetch_page_failed");

    setKbPageUrl(u);
    setKbPageTitle(String(json?.title || "").trim());
    setKbPageText(String(json?.text || "").trim());

    setKbBrandHints({
      primary: json?.colors?.primary_color_guess ?? null,
      accent: json?.colors?.accent_color_guess ?? null,
      logo_url: json?.colors?.logo_url ?? null,
    });

    setToast("Page fetched. Click Add page.");
  }

  function addKbPage() {
    const u = normalizeUrlInput(kbPageUrl);
    if (!u) return setToast("URL missing");
    if (!kbPageText.trim()) return setToast("Text missing (click Fetch page)");

    const page: KbPage = {
      url: u,
      title: (kbPageTitle || "Untitled").trim(),
      text: kbPageText,
      captured_at: new Date().toISOString(),
    };

    setKbPages((prev) => {
      if (prev.some((p) => p.url === u)) return prev;
      return [page, ...prev];
    });

    setKbPageUrl("");
    setKbPageTitle("");
    setKbPageText("");
    setToast("Added");
  }

  function removeKbPage(url: string) {
    setKbPages((prev) => prev.filter((p) => p.url !== url));
  }

  async function generateKbFromPages() {
    if (kbPages.length === 0) return setToast("Add at least one page first");

    setKbAuditRunning(true);
    setKbAuditResult(null);

    const payload = {
      company_id: companyId,
      website_url: kbPages[0]?.url || null,
      persist_profile: kbPersistProfile,
      brand_hints: kbBrandHints
        ? {
            primary_color_guess: kbBrandHints.primary,
            accent_color_guess: kbBrandHints.accent,
            logo_url: kbBrandHints.logo_url,
          }
        : null,
      pages: kbPages.map((p) => ({ url: p.url, title: p.title, text: p.text, captured_at: p.captured_at })),
    };

    const { ok, json } = await fetchJson("/api/admin/knowledge/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setKbAuditRunning(false);
    setKbAuditResult(json);

    if (!ok) return setToast(json?.error || "knowledge_pages_ingest_failed");

    setToast(`Added ${json.inserted_chunks ?? json.chunks ?? "?"} chunks`);

    // refresh chunks + refresh company detail in parent by patching branding_json locally if returned
    if (json?.branding_json) {
      setData((prev: DetailResponse | null) => {
        if (!prev) return prev;
        return { ...prev, settings: { ...prev.settings, branding_json: json.branding_json } };
      });
    }

    await loadKnowledgeChunks();
  }

  function toggleSelect(chunkId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(chunkId)) next.delete(chunkId);
      else next.add(chunkId);
      return next;
    });
  }

  function selectAllVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const r of visibleChunks) next.add(r.id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function bulkDeleteSelected() {
    const ids = Array.from(selectedIds);
    if (!ids.length) return setToast("No items selected");
    const okConfirm = window.confirm(`Delete ${ids.length} item(s)? This cannot be undone.`);
    if (!okConfirm) return;

    const { ok, json } = await fetchJson("/api/admin/knowledge/chunks/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company_id: companyId, ids }),
    });

    if (!ok) return setToast(json?.error || "bulk_delete_failed");

    setToast(`Deleted ${json?.deleted ?? ids.length}`);
    await loadKnowledgeChunks();
  }

  async function deleteChunk(row: KnowledgeChunkRow) {
    const okConfirm = window.confirm("Delete this knowledge item? This cannot be undone.");
    if (!okConfirm) return;

    const { ok, json } = await fetchJson(
      `/api/admin/knowledge/chunks/delete?id=${encodeURIComponent(row.id)}&company_id=${encodeURIComponent(String(companyId))}`,
      { method: "DELETE" }
    );

    if (!ok) return setToast(json?.error || "chunk_delete_failed");

    setToast("Deleted");
    await loadKnowledgeChunks();
  }

  function openPreview(row: KnowledgeChunkRow) {
    setPreviewRow(row);
    setPreviewOpen(true);
  }

  function openEdit(row: KnowledgeChunkRow) {
    setEditRow(row);
    setEditTitle(row.title || "");
    setEditContent(row.content || "");
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!editRow) return;
    setEditSaving(true);

    const { ok, json } = await fetchJson("/api/admin/knowledge/chunks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company_id: companyId, id: editRow.id, title: editTitle, content: editContent }),
    });

    setEditSaving(false);
    if (!ok) return setToast(json?.error || "chunk_update_failed");

    setToast("Saved");
    setEditOpen(false);
    setEditRow(null);
    await loadKnowledgeChunks();
  }

  async function ingestManual() {
    if (!kbText.trim()) return setToast("Paste some text first");

    setKbIngesting(true);
    const { ok, json } = await fetchJson("/api/admin/knowledge/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company_id: companyId, title: kbTitle || "Manual Admin Entry", content: kbText }),
    });
    setKbIngesting(false);

    if (!ok) return setToast(json?.error || "ingest_failed");

    setToast(`Added ${json.chunks ?? json.inserted_chunks ?? "?"} chunks`);
    setKbText("");
    await loadKnowledgeChunks();
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Card
        title="Website → Knowledge"
        subtitle="Fetch website text and generate knowledge. This also helps infer branding automatically."
        right={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: UI.text2 }}>
              <input type="checkbox" checked={kbPersistProfile} onChange={(e) => setKbPersistProfile(e.target.checked)} />
              Save inferred profile/branding
            </label>
            <Button onClick={generateKbFromPages} disabled={kbAuditRunning || kbPages.length === 0} variant="primary">
              {kbAuditRunning ? "Generating…" : "Generate"}
            </Button>
          </div>
        }
      >
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 160px", gap: 10 }}>
            <Input value={kbPageUrl} onChange={(e) => setKbPageUrl(e.target.value)} placeholder="https://yourwebsite.com" />
            <Input value={kbPageTitle} onChange={(e) => setKbPageTitle(e.target.value)} placeholder="Title (optional)" />
            <Button onClick={fetchPageIntoForm} disabled={kbFetching} variant="secondary">
              {kbFetching ? "Fetching…" : "Fetch page"}
            </Button>
          </div>

          <Textarea value={kbPageText} onChange={(e) => setKbPageText(e.target.value)} placeholder="Page text will appear here…" style={{ minHeight: 180 }} />

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button onClick={addKbPage} variant="secondary">
              Add page
            </Button>
            <Button
              onClick={() => {
                setKbPages([]);
                setKbAuditResult(null);
                setKbFetchResult(null);
                setKbBrandHints(null);
                setKbPageUrl("");
                setKbPageTitle("");
                setKbPageText("");
              }}
              variant="secondary"
            >
              Clear
            </Button>
          </div>

          {kbFetchResult ? <CodeBox text={safeJsonStringify(kbFetchResult)} /> : null}

          <div style={{ display: "grid", gap: 10 }}>
            {kbPages.length === 0 ? (
              <div style={{ color: UI.text2, fontSize: 13.5 }}>No pages added yet.</div>
            ) : (
              kbPages.map((p) => (
                <div
                  key={p.url}
                  style={{
                    border: `1px solid ${UI.border}`,
                    borderRadius: UI.radiusLg,
                    padding: 12,
                    background: "#fff",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 1000, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
                    <div style={{ fontSize: 12.5, color: UI.text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.url} · {p.text.length.toLocaleString()} chars
                    </div>
                  </div>
                  <Button onClick={() => removeKbPage(p.url)} variant="danger">
                    Remove
                  </Button>
                </div>
              ))
            )}
          </div>

          {kbAuditResult ? <CodeBox text={safeJsonStringify(kbAuditResult)} /> : null}
        </div>
      </Card>

      <Card
        title="Knowledge items"
        subtitle="Search, preview, edit, delete."
        right={
          <Button onClick={loadKnowledgeChunks} disabled={kbChunksLoading} variant="secondary">
            {kbChunksLoading ? "Loading…" : "Refresh"}
          </Button>
        }
      >
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 160px 160px 120px 120px", gap: 10 }}>
            <Input value={kbChunksQuery} onChange={(e) => setKbChunksQuery(e.target.value)} placeholder="Search…" />
            <select value={kbTypeFilter} onChange={(e) => setKbTypeFilter(e.target.value)} style={{ padding: "11px 12px", borderRadius: 12, border: `1px solid ${UI.border}`, background: "#fff" }}>
              {allTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select value={kbConfFilter} onChange={(e) => setKbConfFilter(e.target.value)} style={{ padding: "11px 12px", borderRadius: 12, border: `1px solid ${UI.border}`, background: "#fff" }}>
              {allConfs.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <Input type="number" min={10} max={200} value={kbChunksLimit} onChange={(e) => setKbChunksLimit(Number(e.target.value || 50))} />
            <Button onClick={loadKnowledgeChunks} disabled={kbChunksLoading} variant="primary">
              Apply
            </Button>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ fontSize: 12.5, color: UI.text2 }}>
              Showing <b>{visibleChunks.length}</b> · Selected <b>{selectedIds.size}</b>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Button onClick={selectAllVisible} disabled={visibleChunks.length === 0} variant="secondary">
                Select visible
              </Button>
              <Button onClick={clearSelection} disabled={selectedIds.size === 0} variant="secondary">
                Clear
              </Button>
              <Button onClick={bulkDeleteSelected} disabled={selectedIds.size === 0} variant="danger">
                Delete selected
              </Button>
            </div>
          </div>

          <div style={{ border: `1px solid ${UI.border}`, borderRadius: UI.radiusLg, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "42px 2.2fr 120px 120px 1.4fr 160px 170px", background: UI.surface2, padding: "10px 12px", fontSize: 12.5, color: UI.text2, fontWeight: 1000, gap: 10, alignItems: "center" }}>
              <div>✓</div>
              <div>Title</div>
              <div>Type</div>
              <div>Conf</div>
              <div>Source</div>
              <div>Date</div>
              <div>Actions</div>
            </div>

            {visibleChunks.length === 0 ? (
              <div style={{ padding: 12, color: UI.text2 }}>No items found.</div>
            ) : (
              visibleChunks.map((c) => {
                const type = String(c?.metadata?.type || "other");
                const conf = String(c?.metadata?.confidence || "medium");
                const isSel = selectedIds.has(c.id);
                const preview = (c.content || "").slice(0, 120).replace(/\s+/g, " ").trim();

                return (
                  <div key={c.id} style={{ display: "grid", gridTemplateColumns: "42px 2.2fr 120px 120px 1.4fr 160px 170px", padding: "10px 12px", borderTop: `1px solid ${UI.border}`, gap: 10, alignItems: "center", background: isSel ? "#F8FAFF" : "#fff" }}>
                    <div>
                      <input type="checkbox" checked={isSel} onChange={() => toggleSelect(c.id)} />
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 1000, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</div>
                      <div style={{ fontSize: 12.5, color: UI.text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preview || "—"}</div>
                    </div>

                    <div style={{ fontSize: 12.5, color: UI.text2, textTransform: "uppercase" }}>{type}</div>
                    <div style={{ fontSize: 12.5, color: UI.text2, textTransform: "uppercase" }}>{conf}</div>
                    <div style={{ fontSize: 12.5, color: UI.text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.source_ref || "—"}</div>
                    <div style={{ fontSize: 12.5, color: UI.text2 }}>{new Date(c.created_at).toLocaleString()}</div>

                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button type="button" onClick={() => openPreview(c)} style={{ border: `1px solid ${UI.border}`, background: "#fff", borderRadius: 999, padding: "7px 10px", fontSize: 12.5, cursor: "pointer", fontWeight: 1000 }}>
                        Preview
                      </button>
                      <button type="button" onClick={() => openEdit(c)} style={{ border: `1px solid ${UI.border}`, background: "#fff", borderRadius: 999, padding: "7px 10px", fontSize: 12.5, cursor: "pointer", fontWeight: 1000 }}>
                        Edit
                      </button>
                      <button type="button" onClick={() => deleteChunk(c)} style={{ border: "1px solid #FECACA", background: "#fff", color: UI.danger, borderRadius: 999, padding: "7px 10px", fontSize: 12.5, cursor: "pointer", fontWeight: 1000 }}>
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Card>

      <Card title="Manual knowledge" subtitle="Paste text to teach the AI.">
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <div style={{ fontSize: 12.5, color: UI.text2, marginBottom: 6 }}>Title</div>
            <Input value={kbTitle} onChange={(e) => setKbTitle(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize: 12.5, color: UI.text2, marginBottom: 6 }}>Content</div>
            <Textarea value={kbText} onChange={(e) => setKbText(e.target.value)} style={{ minHeight: 220 }} />
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button onClick={ingestManual} disabled={kbIngesting} variant="primary">
              {kbIngesting ? "Adding…" : "Add"}
            </Button>
            <Button onClick={() => setKbText("")} variant="secondary">
              Clear
            </Button>
          </div>
        </div>
      </Card>

      {/* Preview modal */}
      {previewOpen && previewRow ? (
        <Modal
          title="Preview Knowledge Item"
          onClose={() => {
            setPreviewOpen(false);
            setPreviewRow(null);
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
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ fontSize: 12.5, color: UI.text2 }}>
              <b>Type:</b> {String(previewRow?.metadata?.type || "other")} · <b>Confidence:</b> {String(previewRow?.metadata?.confidence || "medium")}
            </div>
            <div style={{ fontSize: 12.5, color: UI.text2 }}>
              <b>Source:</b> {previewRow.source_ref || "—"} · <b>Created:</b> {new Date(previewRow.created_at).toLocaleString()}
            </div>
            <CodeBox text={previewRow.content} />
          </div>
        </Modal>
      ) : null}

      {/* Edit modal */}
      {editOpen && editRow ? (
        <Modal
          title="Edit Knowledge Item"
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
            <div>
              <div style={{ fontSize: 12.5, color: UI.text2, marginBottom: 6 }}>Title</div>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 12.5, color: UI.text2, marginBottom: 6 }}>Content</div>
              <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} style={{ minHeight: 320 }} />
            </div>
            <div style={{ fontSize: 12.5, color: UI.text3 }}>Note: Embeddings are not re-generated on edit yet.</div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}