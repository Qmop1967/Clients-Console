"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { BottomNav } from "./bottom-nav";
import { MenuDrawer } from "./menu-drawer";
import { Header } from "./header";
import { DesktopSidebar } from "./desktop-sidebar";
import { useSession } from "next-auth/react";
import { useCart } from "@/components/providers/cart-provider";

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
  const { itemCount } = useCart();

  // Apply saved font-size and display-density settings on mount
  useEffect(() => {
    try {
      const fontScales: Record<string, number> = { small: 0.875, medium: 1, large: 1.125 };
      const densityScales: Record<string, number> = { compact: 0.85, normal: 1, comfortable: 1.15 };
      
      const savedFont = localStorage.getItem('tsh-font-size');
      const savedDensity = localStorage.getItem('tsh-density');
      
      if (savedFont && fontScales[savedFont]) {
        document.documentElement.style.setProperty('--font-scale', String(fontScales[savedFont]));
      }
      
      if (savedDensity && densityScales[savedDensity]) {
        document.documentElement.style.setProperty('--display-density', String(densityScales[savedDensity]));
        const mainEl = document.querySelector('main');
        if (mainEl) {
          (mainEl.style as any).zoom = String(densityScales[savedDensity]);
        }
      }
    } catch {}
  }, []);

  const handleLocaleChange = (newLocale: "en" | "ar") => {
    const segments = pathname.split("/");
    segments[1] = newLocale;
    router.push(segments.join("/"));
  };

  const handleCartClick = () => {
    router.push(`/${locale}/cart`);
  };

  const user = session?.user
    ? {
        name: session.user.name || undefined,
        email: session.user.email || undefined,
      }
    : undefined;

  return (
    <div className="min-h-screen bg-background">
      <Header
        title={title}
        cartCount={itemCount}
        onCartClick={handleCartClick}
        user={user}
        locale={locale}
      />

      <div className="flex">
        {/* Desktop sidebar — persistent, hidden on mobile */}
        <DesktopSidebar />

        {/* Main content area */}
        <main className="flex-1 min-w-0 pb-20 lg:pb-6">
          <div className="lg:max-w-6xl lg:mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile bottom nav — hidden on desktop */}
      <BottomNav onMenuClick={() => setMenuOpen(true)} />

      {/* Mobile menu drawer — only used on mobile */}
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
