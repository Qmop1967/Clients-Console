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

  let data: { data?: unknown[]; total?: number } = { data: [], total: 0 };
  let summary: ConsignmentSummaryData | null = null;
  let catalogue: unknown = { data: [], total: 0 };
  let replenishments: unknown = { data: [], total: 0 };

  try {
    const [listResult, summaryResult, catalogueResult, replenishmentResult] =
      await Promise.allSettled([
        consignmentGatewayFetch("/api/client/consignments?limit=50&offset=0", {
          actor,
        }),
        consignmentGatewayFetch("/api/client/consignments/summary", {
          actor,
        }),
        consignmentGatewayFetch("/api/client/consignments/catalogue", { actor }),
        consignmentGatewayFetch("/api/client/consignments/replenishments", { actor }),
      ]);

    if (listResult.status === "fulfilled") {
      data = (await payload(listResult.value) || data) as typeof data;
    }
    if (summaryResult.status === "fulfilled") {
      summary = await payload(summaryResult.value) as ConsignmentSummaryData | null;
    }
    if (catalogueResult.status === "fulfilled") {
      catalogue = await payload(catalogueResult.value) || catalogue;
    }
    if (replenishmentResult.status === "fulfilled") {
      replenishments = await payload(replenishmentResult.value) || replenishments;
    }
  } catch (error) {
    console.error("[Consignments Page] fetch error:", error);
  }

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
