import { getTranslations } from "next-intl/server";
import { redirect, notFound } from "next/navigation";
import { ConsignmentDetail } from "@/components/consignments/consignment-detail";
import { getImageVersions } from "@/lib/odoo/client";
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

export default async function ConsignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) notFound();

  const actor = await getConsignmentActor();
  if (!actor) redirect(`/login?callbackUrl=/consignments/${numericId}&reason=session_expired`);

  const res = await consignmentGatewayFetch(`/api/client/consignments/${numericId}`, { actor });
  if (res.status === 401 || res.status === 403) {
    redirect(`/login?callbackUrl=/consignments/${numericId}&reason=session_expired`);
  }
  if (res.status === 404) notFound();
  if (!res.ok) throw new Error(`Consignment detail gateway failed (${res.status})`);

  const json = await res.json();
  const data: any = json?.data;

  if (!data) notFound();
  // Defense in depth: strip fields the customer must never receive.
  if (Array.isArray(data.lines)) {
    data.lines = data.lines.map((line: any) => {
      const { x_cost, x_margin, x_cogs, ...safe } = line;
      return safe;
    });
    const ppIds = data.lines.map((line: any) => Number(line.x_product_id)).filter(Boolean);
    try {
      const versions = await getImageVersions(ppIds);
      data.lines = data.lines.map((line: any) => ({
        ...line,
        image_version: versions.get(Number(line.x_product_id)),
      }));
    } catch (error) {
      console.warn("[Consignment Detail Images]", error);
    }
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <ConsignmentDetail
        consignment={data}
        consignmentId={numericId}
      />
    </div>
  );
}
