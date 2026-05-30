"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { PublicBottomNav } from "./public-bottom-nav";
import { MenuDrawer } from "./menu-drawer";
import { useRouter, usePathname } from "next/navigation";

interface PublicLayoutClientProps {
  children: React.ReactNode;
  locale: string;
  footer?: React.ReactNode;
}

export function PublicLayoutClient({ children, locale, footer }: PublicLayoutClientProps) {
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
      {/* ONLY this area scrolls (flex-1). overscroll-none stops rubber-band chaining to the shell. */}
      <main className="flex-1 overflow-y-auto overscroll-none [-webkit-overflow-scrolling:touch]">
        <div className="container mx-auto px-4 py-4 pb-6">{children}</div>
        {footer}
      </main>

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
