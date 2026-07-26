import { MainLayout } from "@/components/layout/main-layout";
import { type Locale } from "@/i18n/config";
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";

// Financial/customer pages must never enter a shared ISR cache.
export const dynamic = "force-dynamic";
export const revalidate = 0;

interface MainAppLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function MainAppLayout({
  children,
  params,
}: MainAppLayoutProps) {
  const { locale } = await params;

  // Middleware is an early UX redirect only. The protected layout validates the
  // signed session again so a forged/expired cookie can never render portal UI.
  const session = await auth();
  if (!session?.user?.odooPartnerId) {
    redirect(`/${locale}/login`);
  }

  return (
    <MainLayout locale={locale as Locale}>
      {children}
    </MainLayout>
  );
}
