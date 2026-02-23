// app/book/[public_key]/page.tsx
import { resolveCompanyByPublicKey } from "@/lib/publicBooking";
import PublicBookingClient from "./publicBookingClient";

export const runtime = "nodejs";

export default async function Page({ params }: { params: Promise<{ public_key: string }> }) {
  const { public_key } = await params;

  const company = await resolveCompanyByPublicKey(public_key);
  if (!company) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui" }}>
        <h1>Booking not found</h1>
        <p>This booking link is invalid.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 8 }}>{company.company_name ?? "Booking"}</h1>
      <p style={{ marginTop: 0, opacity: 0.75 }}>
        Book an appointment. (Trial or Pro required to confirm.)
      </p>

      <PublicBookingClient publicKey={company.public_booking_key} />
    </div>
  );
}