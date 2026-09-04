"use client";

import { useState } from "react";
import type { Locale } from "@/i18n/config";
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
  // The AI assistant is a chat surface: it owns its own scrolling and must end exactly
  // where the bottom nav begins. Container padding + a page-level scroller would push
  // its composer underneath the nav, so it renders full-bleed in a non-scrolling main.
  const fullBleed = /\/assistant(?:\/|$)/.test(pathname || "");
  const { data: session } = useSession();

  const handleLocaleChange = (newLocale: Locale) => {
    // Replace the locale in the pathname
    const segments = pathname.split("/");
    segments[1] = newLocale;
    // Keep the customer's filters (category / search / sort / page) across a language
    // switch — dropping the query string used to silently reset the whole catalog view.
    const query = typeof window !== "undefined" ? window.location.search : "";
    router.push(segments.join("/") + query);
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
      <main
        className={
          fullBleed
            ? "flex min-h-0 flex-1 flex-col overflow-hidden overscroll-none"
            : "flex-1 overflow-y-auto overscroll-none [-webkit-overflow-scrolling:touch]"
        }
      >
        {fullBleed ? (
          children
        ) : (
          <>
            <div className="container mx-auto px-4 py-4 pb-6">{children}</div>
            {footer}
          </>
        )}
      </main>

      {/* Bottom Navigation */}
      <PublicBottomNav onMenuClick={() => setMenuOpen(true)} />

      {/* Menu Drawer */}
      <MenuDrawer
        open={menuOpen}
        onOpenChange={setMenuOpen}
        user={user}
        locale={locale as Locale}
        onLocaleChange={handleLocaleChange}
      />
    </>
  );
}
