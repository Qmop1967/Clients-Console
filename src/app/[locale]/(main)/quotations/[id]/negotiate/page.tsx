import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import NegotiationRoom from "@/components/quotations/negotiation-room";

export const revalidate = 0;

export default async function NegotiatePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const orderId = parseInt(id, 10);
  const currencyCode = session.user.currencyCode || "IQD";

  if (!orderId || Number.isNaN(orderId)) redirect("/quotations");

  return (
    <div className="container mx-auto px-4 py-5">
      <NegotiationRoom orderId={orderId} currencyCode={currencyCode} />
    </div>
  );
}
