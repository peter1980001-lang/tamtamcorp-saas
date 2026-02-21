export type Company = { id: string; name: string; status: string; created_at: string };

export type Keys = {
  company_id: string;
  public_key: string;
  secret_key: string | null;
  allowed_domains: string[];
  created_at: string;
};

export type Settings = { company_id: string; limits_json: any; branding_json: any };

export type AdminRow = {
  id: string;
  company_id: string;
  user_id: string;
  email?: string | null;
  role: string;
  created_at: string;
};

export type InviteRow = {
  id: string;
  company_id: string;
  token: string;
  email: string | null;
  role: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string;
  created_at: string;
  updated_at: string;
  accepted_by: string | null;
  accepted_at: string | null;
  created_by: string | null;
};

export type DetailResponse = {
  company: Company;
  keys: Keys | null;
  settings: Settings;
  admins?: AdminRow[];
  my_role?: "owner" | "admin" | "viewer";
};

export type KnowledgeChunkRow = {
  id: string;
  company_id: string;
  title: string;
  content: string;
  source_ref: string | null;
  metadata: any;
  created_at: string;
};

export type LeadRow = {
  id: string;
  company_id: string;
  conversation_id: string;
  channel: string | null;
  source: string | null;
  lead_state: string;
  status: "new" | "contacted" | "closed" | string;
  name: string | null;
  email: string | null;
  phone: string | null;
  qualification_json: any;
  consents_json: any;
  intent_score: number;
  score_total: number;
  score_band: "cold" | "warm" | "hot";
  tags: string[];
  assigned_to: string | null;
  assigned_at: string | null;
  admin_notes: string | null;
  lead_preview?: string | null;
  lead_summary?: string | null;
  last_touch_at: string | null;
  created_at: string;
  updated_at: string;
};

export type KbPage = { url: string; title: string; text: string; captured_at: string };
export type BrandHints = { primary: string | null; accent: string | null; logo_url: string | null };

export type Tab =
  | "dashboard"
  | "branding"
  | "knowledge"
  | "leads"
  | "team"
  | "billing"
  | "settings"
  // owner-only extras
  | "test-chat"
  | "embed"
  | "domains"
  | "keys"
  | "limits";