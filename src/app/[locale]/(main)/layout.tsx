import { MainLayout } from "@/components/layout/main-layout";
import { type Locale } from "@/i18n/config";

interface MainAppLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function MainAppLayout({
  children,
  params,
}: MainAppLayoutProps) {
  const { locale } = await params;

  return (
    <MainLayout locale={locale as Locale}>
      {children}
    </MainLayout>
  );
}
