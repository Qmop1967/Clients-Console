"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import {
  BadgeCheck,
  ChevronDown,
  FileText,
  LayoutDashboard,
  LogOut,
  Package,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

interface AccountChipProps {
  locale: string;
}

/**
 * AccountChip — persistent account identity in the shop header.
 * Avatar + full account name + customer number, so the customer knows at a
 * glance that the storefront is tied to THEIR account. The dropdown shows
 * identity details plus quick account links and logout.
 *
 * PRIVACY: the visible price tier is a fixed generic label for ALL
 * customers — the internal pricelist tier is never rendered.
 * Mobile: collapses to avatar-only to keep the header compact.
 */
export function AccountChip({ locale }: AccountChipProps) {
  const tNav = useTranslations("nav");
  const tAccount = useTranslations("account");
  const { data: session } = useSession();

  const user = session?.user as
    | { name?: string | null; odooPartnerId?: string; currencyCode?: string }
    | undefined;

  if (!user?.name) return null;

  const displayName = user.name.trim();
  const initial = displayName.charAt(0) || "T";
  const customerNo = user.odooPartnerId ? String(user.odooPartnerId) : undefined;
  const currencyCode = user.currencyCode;

  const handleLogout = async () => {
    try { localStorage.removeItem("tsh_session_recovery"); } catch {}
    await signOut({ redirect: false });
    window.location.href = "/" + locale + "/login";
  };

  const itemClass =
    "flex items-center gap-2 px-2 py-2 rounded-md text-sm text-foreground/80 hover:bg-muted transition-colors";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="native-press flex h-10 items-center gap-2 rounded-xl border border-border/50 bg-background/50 px-1.5 sm:pe-2.5 transition-all hover:border-primary/30 hover:bg-secondary"
          aria-label={displayName}
        >
          <Avatar className="h-7 w-7 border border-border/50">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {initial}
            </AvatarFallback>
          </Avatar>
          <span className="hidden sm:flex flex-col items-start leading-tight text-start">
            <span className="flex items-center gap-1 text-xs font-semibold">
              <span className="max-w-[140px] truncate">{displayName}</span>
              <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
            </span>
            {customerNo && (
              <span className="text-[10px] text-muted-foreground">
                {tAccount("customerNo")}{" "}
                <b className="text-primary font-semibold" dir="ltr">#{customerNo}</b>
              </span>
            )}
          </span>
          <ChevronDown className="hidden sm:block h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="z-[60] w-72 p-2">
        {/* Identity block */}
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar className="h-11 w-11 border border-border/50">
            <AvatarFallback className="bg-primary/10 text-primary text-base font-bold">
              {initial}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="flex items-center gap-1 text-sm font-semibold">
              <span className="truncate">{displayName}</span>
              <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-500" />
              <span className="sr-only">{tAccount("verified")}</span>
            </p>
            {customerNo && (
              <p className="text-xs text-muted-foreground">
                {tAccount("customerNo")}{" "}
                <b className="text-primary font-semibold" dir="ltr">#{customerNo}</b>
              </p>
            )}
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {tAccount("priceTier")}: {tAccount("priceTierValue")}
              {currencyCode ? (
                <>
                  {" · "}
                  <span dir="ltr">{currencyCode}</span>
                </>
              ) : null}
            </p>
          </div>
        </div>
        <Separator className="my-1" />
        <Link href={`/${locale}/dashboard`} className={itemClass}>
          <LayoutDashboard className="h-4 w-4" />
          {tNav("dashboard")}
        </Link>
        <Link href={`/${locale}/orders`} className={itemClass}>
          <Package className="h-4 w-4" />
          {tNav("orders")}
        </Link>
        <Link href={`/${locale}/account-statement`} className={itemClass}>
          <FileText className="h-4 w-4" />
          {tNav("accountStatement")}
        </Link>
        <Separator className="my-1" />
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-2 py-2 rounded-md text-sm text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          {tNav("logout")}
        </button>
      </PopoverContent>
    </Popover>
  );
}
