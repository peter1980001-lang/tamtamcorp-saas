export const dynamic = "force-dynamic";

import LoginClient from "./LoginClient";

export default function LoginPage(props: { searchParams?: { next?: string } }) {
  const next = String(props?.searchParams?.next || "").trim();
  return <LoginClient next={next} />;
}
