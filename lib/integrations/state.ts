import crypto from "crypto";

const SECRET = process.env.INTEGRATIONS_STATE_SECRET || "";

export function signState(payload: any) {
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json, "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(b64).digest("base64url");
  return `${b64}.${sig}`;
}

export function verifyState(state: string) {
  const [b64, sig] = String(state || "").split(".");
  if (!b64 || !sig) return null;
  const expected = crypto.createHmac("sha256", SECRET).update(b64).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const json = Buffer.from(b64, "base64url").toString("utf8");
  return JSON.parse(json);
}