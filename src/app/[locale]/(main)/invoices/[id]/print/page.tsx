import { auth } from "@/lib/auth/auth";
import { redirect, notFound } from "next/navigation";
import { getInvoice } from "@/lib/odoo/invoices";
import InvoicePrintView from "@/components/invoices/invoice-print-view";
import { odooRead } from "@/lib/odoo/client";

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

  // Document language follows customer preference (x_doc_language), not UI locale
  let docLang = "ar";
  try {
    const pid = parseInt(String(session.user.odooPartnerId || "0"));
    if (pid) {
      const rows = await odooRead<{ x_doc_language?: string | false }>(
        "res.partner", [pid], ["x_doc_language"]
      );
      if (rows?.[0]?.x_doc_language) docLang = String(rows[0].x_doc_language);
    }
  } catch { /* default ar */ }

  // FIX 2026-07-02 (E2E finding): never ship the long sale description to the
  // print client. It is not rendered, but it leaked into the RSC payload
  // (visible in view-source, bloats the page). Ship only what we render.
  const printInvoice = {
    ...invoice,
    line_items: (invoice.line_items || []).map((l) => ({ ...l, description: "" })),
  };

  return <InvoicePrintView invoice={printInvoice} docLang={docLang} />;
}
