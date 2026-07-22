import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { ConsignmentsList } from "@/components/consignments/consignments-list";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata() {
  const t = await getTranslations("consignments");
  return { title: t("title") };
}

export default async function ConsignmentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.odooPartnerId) {
    return (
      <div className="container mx-auto px-4 py-6">
        <ConsignmentsList consignments={[]} total={0} summary={null} />
      </div>
    );
  }

  let data: any = { data: [], total: 0 };
  let summary: any = null;
  try {
    const GW = process.env.API_GATEWAY_URL || "http://127.0.0.1:3010";
    const KEY = process.env.API_KEY || "";
    const headers = {
      "x-api-key": KEY,
      "x-partner-id": session.user.odooPartnerId,
      "Content-Type": "application/json",
    } as Record<string, string>;
    const [listRes, sumRes] = await Promise.allSettled([
      fetch(`${GW}/api/client/consignments?limit=50&offset=0`, { headers, cache: "no-store" }),
      fetch(`${GW}/api/client/consignments/summary`, { headers, cache: "no-store" }),
    ]);
    if (listRes.status === "fulfilled" && listRes.value.ok) data = await listRes.value.json();
    if (sumRes.status === "fulfilled" && sumRes.value.ok) summary = await sumRes.value.json();
  } catch (e) {
    console.error("[Consignments Page] fetch error:", e);
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <ConsignmentsList
        consignments={data.data || []}
        total={data.total || 0}
        summary={summary}
      />
    </div>
  );
}
