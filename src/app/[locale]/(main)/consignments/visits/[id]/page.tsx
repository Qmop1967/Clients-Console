import { getTranslations } from "next-intl/server";
import { redirect, notFound } from "next/navigation";
import { CustodyVisitReport } from "@/components/consignments/custody-visit-report";
import { getConsignmentActor } from "@/lib/consignments/server-gateway";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function generateMetadata() {
  const t = await getTranslations("consignments");
  return { title: t("visitReportTitle") };
}

export default async function CustodyVisitReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) notFound();
  const actor = await getConsignmentActor();
  if (!actor) redirect(`/login?callbackUrl=/consignments/visits/${numericId}&reason=session_expired`);
  return (
    <div className="container mx-auto px-4 py-6">
      <CustodyVisitReport visitId={numericId} />
    </div>
  );
}
