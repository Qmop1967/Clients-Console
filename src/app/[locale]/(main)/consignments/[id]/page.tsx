import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth/auth";
import { redirect, notFound } from "next/navigation";
import { ConsignmentDetail } from "@/components/consignments/consignment-detail";
import { getImageVersions } from "@/lib/odoo/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata() {
  const t = await getTranslations("consignments");
  return { title: t("title") };
}

export default async function ConsignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.odooPartnerId) notFound();

  const { id } = await params;
  let data: any = null;

  try {
    const GW = process.env.API_GATEWAY_URL || "http://127.0.0.1:3010";
    const KEY = process.env.API_KEY || "";
    const res = await fetch(`${GW}/api/client/consignments/${id}`, {
      headers: { "x-api-key": KEY, "x-partner-id": session.user.odooPartnerId, "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (res.status === 404) notFound();
    if (res.ok) {
      const json = await res.json();
      data = json.data;
      // Defense in depth: strip sensitive fields
      if (data?.lines) {
        data.lines = data.lines.map((l: any) => {
          const { x_cost, x_margin, x_cogs, ...safe } = l; // keep x_invoice_unit_price — customer's own purchase price
          return safe;
        });
        // Attach image_version per line (x_product_id is pp_id — product_product.id).
        // Batched gateway lookup of ir.attachment write_date; missing => box-icon fallback.
        const ppIds = data.lines.map((l: any) => Number(l.x_product_id)).filter(Boolean);
        const versions = await getImageVersions(ppIds);
        data.lines = data.lines.map((l: any) => ({
          ...l,
          image_version: versions.get(Number(l.x_product_id)),
        }));
      }
    }
  } catch (e) {
    console.error("[Consignment Detail Page]", e);
  }

  if (!data) notFound();

  return (
    <div className="container mx-auto px-4 py-6">
      <ConsignmentDetail
        consignment={data}
        consignmentId={parseInt(id)}
      />
    </div>
  );
}
