import { auth } from "@/lib/auth/auth";
import { redirect, notFound } from "next/navigation";
import { getInvoice } from "@/lib/odoo/invoices";
import InvoicePrintView from "@/components/invoices/invoice-print-view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return { title: `Invoice ${id}` };
}

export default async function InvoicePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const invoice = await getInvoice(id, session.user.odooPartnerId || "");

  if (!invoice) notFound();

  return <InvoicePrintView invoice={invoice} />;
}
