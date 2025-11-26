"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { BottomNav } from "./bottom-nav";
import { MenuDrawer } from "./menu-drawer";
import { Header } from "./header";
import { useSession } from "next-auth/react";

interface MainLayoutProps {
  children: React.ReactNode;
  title?: string;
  locale: "en" | "ar";
}

export function MainLayout({ children, title, locale }: MainLayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();

  const handleLocaleChange = (newLocale: "en" | "ar") => {
    // Replace the locale in the pathname
    const segments = pathname.split("/");
    segments[1] = newLocale;
    router.push(segments.join("/"));
  };

  const user = session?.user
    ? {
        name: session.user.name || undefined,
        email: session.user.email || undefined,
      }
    : undefined;

  return (
    <div className="min-h-screen bg-background">
      <Header title={title} />

      <main className="pb-20">{children}</main>

      <BottomNav onMenuClick={() => setMenuOpen(true)} />

      <MenuDrawer
        open={menuOpen}
        onOpenChange={setMenuOpen}
        user={user}
        locale={locale}
        onLocaleChange={handleLocaleChange}
      />
    </div>
  );
}
