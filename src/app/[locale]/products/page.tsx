import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ locale: string }>;
}

// Redirect /products to /shop for backward compatibility
// This page is outside the (main) protected route group
// so it redirects without requiring authentication
export default async function ProductsRedirect({ params }: PageProps) {
  const { locale } = await params;
  redirect(`/${locale}/shop`);
}
