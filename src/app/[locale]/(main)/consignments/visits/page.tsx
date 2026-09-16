import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { CustodyVisitsList } from "@/components/consignments/custody-visits-list";
import {
  consignmentGatewayFetch,
  getConsignmentActor,
} from "@/lib/consignments/server-gateway";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function generateMetadata() {
  const t = await getTranslations("consignments");
  return { title: t("visitsTitle") };
}

export default async function CustodyVisitsPage() {
  const actor = await getConsignmentActor();
  if (!actor) redirect("/login?callbackUrl=/consignments/visits&reason=session_expired");

  const res = await consignmentGatewayFetch("/api/client/consignments/visits", { actor });
  if (res.status === 401 || res.status === 403) {
    redirect("/login?callbackUrl=/consignments/visits&reason=session_expired");
  }
  if (!res.ok) throw new Error(`Consignment visits gateway failed (${res.status})`);
  const json = await res.json().catch(() => ({ data: [] }));
  const visits = Array.isArray(json?.data) ? json.data : [];

  return (
    <div className="container mx-auto px-4 py-6">
      <CustodyVisitsList visits={visits} />
    </div>
  );
}
