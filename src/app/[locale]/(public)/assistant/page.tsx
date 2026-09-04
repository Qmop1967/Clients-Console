import type { Metadata } from "next";
import { AssistantChat } from "@/components/assistant/AssistantChat";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "مساعد مبيعات TSH — أسعار وتوفر فوري",
  description: "اسأل مساعد مبيعات TSH الذكي عن المنتجات والأسعار والتوفر، ابحث بصورة، أو ابدأ حساب تاجر جملة.",
  robots: { index: false },
};

export default async function AssistantPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <AssistantChat locale={locale} />;
}
