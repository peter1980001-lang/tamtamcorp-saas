export const dynamic = "force-dynamic";

import InviteClient from "./InviteClient";

export default function InvitePage(props: { searchParams?: { token?: string } }) {
  const token = String(props?.searchParams?.token || "").trim();
  return <InviteClient token={token} />;
}
