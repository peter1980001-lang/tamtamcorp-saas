import BillingClient from "./BillingClient";
import { supabaseServer } from "@/lib/supabaseServer";
// optional, falls du es im Projekt hast:
// import { requireOwner } from "@/lib/adminGuard";

export default async function CompanyBillingPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id: companyId } = await props.params;

  // Falls du serverseitig Owner-Guard nutzt, hier aktivieren:
  // await requireOwner(companyId);

  const [{ data: plans }, { data: billing }] = await Promise.all([
    supabaseServer
      .from("billing_plans")
      .select("plan_key,name,stripe_price_id,entitlements_json,is_active")
      .eq("is_active", true),
    supabaseServer
      .from("company_billing")
      .select("status,plan_key,stripe_price_id,current_period_end")
      .eq("company_id", companyId)
      .maybeSingle(),
  ]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="text-2xl font-bold">Billing</div>
        <div className="mt-1 text-sm text-gray-600">
          Company: <span className="font-mono text-gray-900">{companyId}</span>
        </div>
      </div>

      <BillingClient companyId={companyId} plans={(plans ?? []) as any} billing={(billing ?? null) as any} />
    </div>
  );
}
