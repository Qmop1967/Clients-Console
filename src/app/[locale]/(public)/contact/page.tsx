import { redirect } from "next/navigation";

// This old support page carried placeholder contact data (a fake phone number and an
// unmonitored mailbox). One contact page only: /contact-us (Khaleel 2026-09-19 — contact
// is WhatsApp or the registration form).
export default async function PublicSupportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale}/contact-us`);
}
