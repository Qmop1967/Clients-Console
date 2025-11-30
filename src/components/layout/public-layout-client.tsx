"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { PublicBottomNav } from "./public-bottom-nav";
import { MenuDrawer } from "./menu-drawer";
import { useRouter, usePathname } from "next/navigation";

interface PublicLayoutClientProps {
  children: React.ReactNode;
  locale: string;
}

export function PublicLayoutClient({ children, locale }: PublicLayoutClientProps) {
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
    <>
      {/* Main Content with padding for bottom nav */}
      <main className="container mx-auto px-4 py-6 pb-24">{children}</main>

      {/* Bottom Navigation */}
      <PublicBottomNav onMenuClick={() => setMenuOpen(true)} />

      {/* Menu Drawer */}
      <MenuDrawer
        open={menuOpen}
        onOpenChange={setMenuOpen}
        user={user}
        locale={locale as "en" | "ar"}
        onLocaleChange={handleLocaleChange}
      />
    </>
  );
}
