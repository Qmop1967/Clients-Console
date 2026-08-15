import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { ConsignmentsList } from "@/components/consignments/consignments-list";
import type { ConsignmentSummaryData } from "@/components/consignments/consignment-summary";
import {
  consignmentGatewayFetch,
  getConsignmentActor,
} from "@/lib/consignments/server-gateway";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function generateMetadata() {
  const t = await getTranslations("consignments");
  return { title: t("title") };
}

async function payload(response: Response): Promise<unknown> {
  return response.ok ? response.json().catch(() => null) : null;
}

export default async function ConsignmentsPage() {
  const actor = await getConsignmentActor();
  if (!actor) redirect("/login");

  const [listResponse, summaryResponse, catalogueResponse, replenishmentResponse] = await Promise.all([
    consignmentGatewayFetch("/api/client/consignments?limit=50&offset=0", { actor }),
    consignmentGatewayFetch("/api/client/consignments/summary", { actor }),
    consignmentGatewayFetch("/api/client/consignments/catalogue", { actor }),
    consignmentGatewayFetch("/api/client/consignments/replenishments", { actor }),
  ]);

  if ([listResponse, summaryResponse, catalogueResponse, replenishmentResponse]
    .some((response) => response.status === 401 || response.status === 403)) {
    redirect("/login?callbackUrl=/consignments&reason=session_expired");
  }

  // The list and catalogue are the page's primary truth. Never render a false
  // empty state when either failed upstream.
  if (!listResponse.ok || !catalogueResponse.ok) {
    throw new Error(`Consignment page gateway failed (list=${listResponse.status}, catalogue=${catalogueResponse.status})`);
  }

  const data = (await payload(listResponse) || { data: [], total: 0 }) as {
    data?: unknown[];
    total?: number;
  };
  const summary = await payload(summaryResponse) as ConsignmentSummaryData | null;
  const catalogue = await payload(catalogueResponse) || { data: [], total: 0 };
  const replenishments = await payload(replenishmentResponse) || { data: [], total: 0 };

  return (
    <div className="container mx-auto px-4 py-6">
      <ConsignmentsList
        consignments={Array.isArray(data.data) ? data.data as never[] : []}
        total={Number(data.total || 0)}
        summary={summary}
        partnerId={actor.partnerId}
        initialCatalogue={catalogue}
        initialReplenishments={replenishments}
      />
    </div>
  );
}
