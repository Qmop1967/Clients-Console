import { redirect } from "next/navigation";

interface LocalePageProps {
  params: Promise<{ locale: string }>;
}

export default async function LocalePage({ params }: LocalePageProps) {
  const { locale } = await params;
  // Redirect to the public shop page
  redirect(`/${locale}/shop`);
}
